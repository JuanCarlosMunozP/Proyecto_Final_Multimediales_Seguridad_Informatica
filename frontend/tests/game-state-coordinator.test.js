import { describe, expect, it } from 'vitest';
import { crearCoordinador } from '../src/juego/game-state-coordinator.js';

// POL-FSM-001 A / RF-005: reloj inyectado, sin scheduler ni navegador.
function preparar() {
  let tiempo = 100;
  const coordinador = crearCoordinador({ ahora: () => tiempo });
  return { coordinador, avanzar: (ms) => { tiempo += ms; } };
}
function iniciar(coordinador) {
  expect(coordinador.despachar('LOAD_COMPLETE')).toEqual({ aceptada: true, estado: 'inicio' });
  expect(coordinador.despachar('START')).toEqual({ aceptada: true, estado: 'jugando' });
}
const muerte = { vida: 0, vivo: false };
function rechaza(resultado, estado, motivo) {
  expect(resultado).toEqual({ aceptada: false, estado, motivo });
}

describe('Coordinador aislado: POL-FSM-001 A', () => {
  it('TC-COORD-001: carga, inicio, cinematica, pausa y reanudación (RF-001)', () => {
    const { coordinador: c } = preparar();
    expect(c.getEstado()).toBe('cargando');
    iniciar(c);
    expect(c.despachar('START_CINEMATIC')).toEqual({ aceptada: true, estado: 'cinematica' });
    expect(c.despachar('PAUSE')).toEqual({ aceptada: true, estado: 'pausa' });
    expect(c.despachar('RESUME', { cineActivo: true }))
      .toEqual({ aceptada: true, estado: 'cinematica' });
    expect(c.despachar('CINEMATIC_END')).toEqual({ aceptada: true, estado: 'jugando' });
  });

  it('TC-COORD-002: muerte pendiente finaliza desde pausa al vencer, solo una vez', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const pendiente = c.programarDerrota(Object.freeze({ ...muerte }));
    expect(pendiente.aceptada).toBe(true);
    expect(typeof pendiente.resolver).toBe('function');
    expect(Object.keys(pendiente).sort()).toEqual(['aceptada', 'estado', 'resolver']);
    expect(c.getEstado()).toBe('jugando');
    c.despachar('PAUSE');
    avanzar(1499);
    rechaza(pendiente.resolver(), 'pausa', 'DERROTA_NO_VENCIDA');
    expect(c.getEstado()).toBe('pausa');
    avanzar(1);
    expect(pendiente.resolver()).toEqual({ aceptada: true, estado: 'derrota' });
    rechaza(pendiente.resolver(), 'derrota', 'DERROTA_NO_VIGENTE');
    rechaza(c.despachar('RESUME'), 'derrota', 'TRANSICION_NO_PERMITIDA');
    expect(c.getEstado()).toBe('derrota');
  });

  it('TC-COORD-003: reanudar no cancela ni desplaza plazo original', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    avanzar(700);
    c.despachar('PAUSE');
    avanzar(700);
    expect(c.despachar('RESUME')).toEqual({ aceptada: true, estado: 'jugando' });
    rechaza(resolver(), 'jugando', 'DERROTA_NO_VENCIDA');
    avanzar(100);
    expect(resolver()).toEqual({ aceptada: true, estado: 'derrota' });
  });

  it('TC-COORD-004: argumentos externos no adelantan el callback ni autorizan LOSE', () => {
    const { coordinador: c } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    c.despachar('PAUSE');
    rechaza(resolver({ vencido: true, ahora: Infinity }), 'pausa', 'DERROTA_NO_VENCIDA');
    rechaza(c.despachar('LOSE', { muertePendiente: true, vencido: true }),
      'pausa', 'DERROTA_NO_AUTORIZADA');
  });

  it.each(['cargando', 'inicio', 'jugando', 'pausa', 'cinematica', 'victoria', 'derrota'])
  ('TC-COORD-005: LOSE genérico no autoriza derrota desde %s', (estado) => {
    const { coordinador: c, avanzar } = preparar();
    if (estado !== 'cargando') c.despachar('LOAD_COMPLETE');
    if (!['cargando', 'inicio'].includes(estado)) c.despachar('START');
    if (estado === 'pausa') c.despachar('PAUSE');
    if (estado === 'cinematica') c.despachar('START_CINEMATIC');
    if (estado === 'victoria') c.despachar('WIN');
    if (estado === 'derrota') {
      const { resolver } = c.programarDerrota(muerte);
      avanzar(1500);
      resolver();
    }
    expect(c.getEstado()).toBe(estado);
    rechaza(c.despachar('LOSE'), estado, 'DERROTA_NO_AUTORIZADA');
    expect(c.getEstado()).toBe(estado);
  });

  it.each([null, undefined, [], true, 'muerto', {}, { vida: 1, vivo: false },
    { vida: NaN, vivo: false }, { vida: Infinity, vivo: false },
    { vida: '0', vivo: false }, { vida: 0, vivo: true }, { vida: 0, vivo: 0 }])
  ('TC-COORD-006: rechaza evidencia de muerte inválida %#', (evidencia) => {
    const { coordinador: c } = preparar();
    iniciar(c);
    rechaza(c.programarDerrota(evidencia), 'jugando', 'EVIDENCIA_MUERTE_INVALIDA');
    expect(c.getEstado()).toBe('jugando');
    expect(c.programarDerrota(muerte).aceptada).toBe(true);
  });

  it('TC-COORD-007: rechaza duplicado sin reemplazar la programación original', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    avanzar(1000);
    rechaza(c.programarDerrota(muerte), 'jugando', 'DERROTA_YA_PENDIENTE');
    avanzar(500);
    expect(resolver()).toEqual({ aceptada: true, estado: 'derrota' });
  });

  it('TC-COORD-008: reset invalida callback anterior y permite una muerte nueva', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const anterior = c.programarDerrota(muerte);
    c.reiniciarPartida();
    expect(c.getEstado()).toBe('cargando');
    iniciar(c);
    const nueva = c.programarDerrota(muerte);
    avanzar(1500);
    rechaza(anterior.resolver(), 'jugando', 'DERROTA_NO_VIGENTE');
    expect(nueva.resolver()).toEqual({ aceptada: true, estado: 'derrota' });
  });

  it('TC-COORD-009: callback ajeno no puede finalizar otro coordinador', () => {
    const a = preparar();
    const b = preparar();
    iniciar(a.coordinador);
    iniciar(b.coordinador);
    const { resolver } = a.coordinador.programarDerrota(muerte);
    a.avanzar(1500);
    expect(resolver.call(b.coordinador, { partida: b.coordinador }))
      .toEqual({ aceptada: true, estado: 'derrota' });
    expect(b.coordinador.getEstado()).toBe('jugando');
  });

  it('TC-COORD-010: victoria anterior invalida pendiente y finaliza solo una vez', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    expect(c.despachar('WIN')).toEqual({ aceptada: true, estado: 'victoria' });
    avanzar(1500);
    rechaza(resolver(), 'victoria', 'DERROTA_NO_VIGENTE');
    rechaza(c.despachar('WIN'), 'victoria', 'TRANSICION_NO_PERMITIDA');
    expect(c.getEstado()).toBe('victoria');
  });

  it.each(['toString', 'constructor', '__proto__', 'INVENTADO', null, 0,
    new String('PAUSE'), ['PAUSE'], { toString: () => 'PAUSE' }, Symbol('PAUSE')])
  ('TC-COORD-011: rechaza evento ajeno al contrato %#', (evento) => {
    const { coordinador: c } = preparar();
    iniciar(c);
    rechaza(c.despachar(evento), 'jugando', 'TRANSICION_NO_PERMITIDA');
    expect(c.getEstado()).toBe('jugando');
  });

  it('TC-COORD-012: contexto inválido no cambia estado ni borra muerte pendiente', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    rechaza(c.despachar('PAUSE', null), 'jugando', 'CONTEXTO_INVALIDO');
    rechaza(c.despachar('PAUSE', { cineActivo: 'true' }), 'jugando', 'CONTEXTO_INVALIDO');
    avanzar(1500);
    expect(resolver()).toEqual({ aceptada: true, estado: 'derrota' });
  });

  it('TC-COORD-013: programación exige juego y no crea permiso desde pausa', () => {
    const { coordinador: c } = preparar();
    iniciar(c);
    c.despachar('PAUSE');
    rechaza(c.programarDerrota(muerte), 'pausa', 'TRANSICION_NO_PERMITIDA');
    rechaza(c.despachar('LOSE', { vida: 0, vivo: false }), 'pausa', 'DERROTA_NO_AUTORIZADA');
  });

  it.each([null, 42, () => NaN, () => Infinity, () => '100'])
  ('TC-COORD-014: reloj inválido no crea autorización %#', (ahora) => {
    const c = crearCoordinador({ ahora });
    iniciar(c);
    rechaza(c.programarDerrota(muerte), 'jugando', 'RELOJ_INVALIDO');
    expect(c.getEstado()).toBe('jugando');
  });

  it('TC-COORD-015: reloj inválido al resolver no consume autorización', () => {
    let tiempo = 0;
    const c = crearCoordinador({ ahora: () => tiempo });
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    tiempo = NaN;
    rechaza(resolver(), 'jugando', 'RELOJ_INVALIDO');
    tiempo = 1500;
    expect(resolver()).toEqual({ aceptada: true, estado: 'derrota' });
  });

  it('TC-COORD-016: pendiente no autoriza resolver desde cinematica', () => {
    const { coordinador: c, avanzar } = preparar();
    iniciar(c);
    const { resolver } = c.programarDerrota(muerte);
    c.despachar('START_CINEMATIC');
    avanzar(1500);
    rechaza(resolver(), 'cinematica', 'TRANSICION_NO_PERMITIDA');
    expect(c.getEstado()).toBe('cinematica');
  });
});
