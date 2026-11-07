import { describe, expect, it, vi } from 'vitest';
import { crearAdaptadores } from '../src/juego/game-state-adapters.js';

// Scheduler manual: conserva callbacks cancelados para simular entregas tardías.
// No usa setTimeout, fake timers ni reloj del sistema.
function crearTiempoManual() {
  let tiempo = 0;
  const tareas = [];
  const programar = (callback, demora) => {
    const tarea = { callback, demora, vence: tiempo + demora, cancelada: false };
    tareas.push(tarea);
    return tarea;
  };
  return {
    ahora: () => tiempo,
    avanzar: (ms) => { tiempo += ms; },
    programar,
    cancelar: (tarea) => { tarea.cancelada = true; },
    tareas,
    disparar: (tarea) => tarea.callback(),
  };
}

function preparar() {
  const reloj = crearTiempoManual();
  const efectos = { muerte: vi.fn(), transicion: vi.fn(), terminal: vi.fn() };
  const api = crearAdaptadores({
    ahora: reloj.ahora, programar: reloj.programar, cancelar: reloj.cancelar, efectos,
  });
  api.despachar('LOAD_COMPLETE');
  api.despachar('START');
  efectos.transicion.mockClear();
  return { api, reloj, efectos };
}
const muerte = { vida: 0, vivo: false };
const aceptada = (estado) => ({ aceptada: true, estado });
const rechazo = (estado, motivo) => ({ aceptada: false, estado, motivo });

// Doble de daño, no prueba del camino real main.js/danar.
function crearDanoSimulado(api) {
  const jugador = { vida: 10, vivo: true };
  return {
    jugador,
    aplicar(cantidad) {
      if (!jugador.vivo) return;
      jugador.vida = Math.max(0, jugador.vida - cantidad);
      if (jugador.vida === 0) {
        jugador.vivo = false;
        return api.programarDerrota(jugador);
      }
    },
  };
}

describe('Adaptadores aislados: integración simulada (POL-FSM-001 A)', () => {
  it('TC-ADAPT-001: daño simulado no letal, letal y repetido registra una muerte', () => {
    const { api, reloj, efectos } = preparar();
    const dano = crearDanoSimulado(api);
    dano.aplicar(3);
    expect(dano.jugador).toEqual({ vida: 7, vivo: true });
    expect(reloj.tareas).toHaveLength(0);
    expect(api.programarDerrota(dano.jugador))
      .toEqual(rechazo('jugando', 'EVIDENCIA_MUERTE_INVALIDA'));
    expect(dano.aplicar(7)).toEqual(aceptada('jugando'));
    dano.aplicar(10);
    expect(api.programarDerrota(dano.jugador))
      .toEqual(rechazo('jugando', 'DERROTA_YA_PENDIENTE'));
    expect(reloj.tareas).toHaveLength(1);
    expect(reloj.tareas[0].demora).toBe(1500);
    expect(efectos.muerte).toHaveBeenCalledTimes(1);
    expect(efectos.terminal).not.toHaveBeenCalled();
  });

  it('TC-ADAPT-002: scheduler resuelve a 1500 ms desde pausa sin reanudar', () => {
    const { api, reloj, efectos } = preparar();
    api.programarDerrota(muerte);
    expect(api.perderPuntero()).toEqual(aceptada('pausa'));
    reloj.avanzar(1500);
    expect(reloj.disparar(reloj.tareas[0])).toEqual(aceptada('derrota'));
    expect(api.getEstado()).toBe('derrota');
    expect(efectos.terminal).toHaveBeenCalledExactlyOnceWith(aceptada('derrota'));
    expect(efectos.transicion).toHaveBeenCalledTimes(1);
  });

  it('TC-ADAPT-003: pausa y reanudación conservan el timer y plazo original', () => {
    const { api, reloj } = preparar();
    api.programarDerrota(muerte);
    reloj.avanzar(700);
    api.perderPuntero();
    reloj.avanzar(700);
    api.despachar('RESUME');
    expect(reloj.tareas).toHaveLength(1);
    expect(reloj.tareas[0].vence).toBe(1500);
    reloj.avanzar(100);
    expect(reloj.disparar(reloj.tareas[0])).toEqual(aceptada('derrota'));
  });

  it('TC-ADAPT-004: callback prematuro rearma solo restante sin duplicar muerte', () => {
    const { api, reloj, efectos } = preparar();
    api.programarDerrota(muerte);
    reloj.avanzar(1499);
    expect(reloj.disparar(reloj.tareas[0]))
      .toEqual(rechazo('jugando', 'DERROTA_NO_VENCIDA'));
    expect(reloj.tareas).toHaveLength(2);
    expect(reloj.tareas[1].demora).toBe(1);
    expect(reloj.disparar(reloj.tareas[0]))
      .toEqual(rechazo('jugando', 'CALLBACK_NO_VIGENTE'));
    expect(reloj.tareas).toHaveLength(2);
    expect(efectos.terminal).not.toHaveBeenCalled();
    expect(efectos.muerte).toHaveBeenCalledTimes(1);
    reloj.avanzar(1);
    expect(reloj.disparar(reloj.tareas[1])).toEqual(aceptada('derrota'));
  });

  it('TC-ADAPT-005: callbacks duplicados/consumidos no repiten terminal', () => {
    const { api, reloj, efectos } = preparar();
    api.programarDerrota(muerte);
    const tarea = reloj.tareas[0];
    reloj.avanzar(1500);
    expect(reloj.disparar(tarea)).toEqual(aceptada('derrota'));
    expect(reloj.disparar(tarea)).toEqual(rechazo('derrota', 'CALLBACK_NO_VIGENTE'));
    expect(efectos.terminal).toHaveBeenCalledTimes(1);
    expect(efectos.muerte).toHaveBeenCalledTimes(1);
  });

  it('TC-ADAPT-006: reset y destrucción invalidan callbacks aunque sean entregados', () => {
    const { api, reloj, efectos } = preparar();
    api.programarDerrota(muerte);
    const antigua = reloj.tareas[0];
    api.reiniciarPartida();
    expect(antigua.cancelada).toBe(true);
    api.despachar('LOAD_COMPLETE');
    api.despachar('START');
    api.programarDerrota(muerte);
    const nueva = reloj.tareas[1];
    reloj.avanzar(1500);
    expect(reloj.disparar(antigua)).toEqual(rechazo('jugando', 'CALLBACK_NO_VIGENTE'));
    expect(api.getEstado()).toBe('jugando');
    api.destruir();
    expect(nueva.cancelada).toBe(true);
    expect(reloj.disparar(nueva).aceptada).toBe(false);
    expect(api.despachar('WIN')).toEqual(rechazo('jugando', 'ADAPTADOR_DESTRUIDO'));
    expect(efectos.terminal).not.toHaveBeenCalled();
  });

  it('TC-ADAPT-007: victoria previa cancela muerte y efectos terminales únicos', () => {
    const { api, reloj, efectos } = preparar();
    api.programarDerrota(muerte);
    expect(api.despachar('WIN')).toEqual(aceptada('victoria'));
    expect(reloj.tareas[0].cancelada).toBe(true);
    reloj.avanzar(1500);
    expect(reloj.disparar(reloj.tareas[0])).toEqual(rechazo('victoria', 'CALLBACK_NO_VIGENTE'));
    expect(api.despachar('WIN').aceptada).toBe(false);
    expect(efectos.terminal).toHaveBeenCalledExactlyOnceWith(aceptada('victoria'));
  });

  it('TC-ADAPT-008: terminal se publica antes de efectos y pérdida de puntero', () => {
    const { api, reloj, efectos } = preparar();
    const observados = [];
    efectos.terminal.mockImplementation((resultado) => {
      observados.push(api.getEstado());
      expect(api.perderPuntero())
        .toEqual(rechazo(resultado.estado, 'TRANSICION_NO_PERMITIDA'));
    });
    api.programarDerrota(muerte);
    reloj.avanzar(1500);
    reloj.disparar(reloj.tareas[0]);
    expect(observados).toEqual(['derrota']);
    expect(efectos.transicion).not.toHaveBeenCalled();
    expect(api.getEstado()).toBe('derrota');
  });

  it.each(['victoria', 'derrota'])
  ('TC-ADAPT-009: cine residual no reabre %s y cine válido emite efecto', (terminal) => {
    const { api, reloj, efectos } = preparar();
    api.despachar('START_CINEMATIC');
    expect(api.finalizarCinematica()).toEqual(aceptada('jugando'));
    expect(efectos.transicion).toHaveBeenLastCalledWith(aceptada('jugando'), 'CINEMATIC_END');
    if (terminal === 'victoria') api.despachar('WIN');
    else {
      api.programarDerrota(muerte);
      reloj.avanzar(1500);
      reloj.disparar(reloj.tareas[0]);
    }
    efectos.transicion.mockClear();
    expect(api.finalizarCinematica())
      .toEqual(rechazo(terminal, 'TRANSICION_NO_PERMITIDA'));
    expect(api.getEstado()).toBe(terminal);
    expect(efectos.transicion).not.toHaveBeenCalled();
    expect(efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it('TC-ADAPT-010: entradas y registros rechazados producen cero efectos', () => {
    const { api, reloj, efectos } = preparar();
    for (const evento of ['LOSE', 'constructor', '__proto__', 'toString', ['PAUSE']]) {
      expect(api.despachar(evento).aceptada).toBe(false);
    }
    expect(api.despachar('PAUSE', null).aceptada).toBe(false);
    expect(api.programarDerrota({ vida: 10, vivo: true }).aceptada).toBe(false);
    expect(api.finalizarCinematica().aceptada).toBe(false);
    expect(api.getEstado()).toBe('jugando');
    expect(reloj.tareas).toHaveLength(0);
    for (const efecto of Object.values(efectos)) expect(efecto).not.toHaveBeenCalled();
  });

  it('TC-ADAPT-011: callback ligado a A no puede finalizar instancia B', () => {
    const a = preparar();
    const b = preparar();
    a.api.programarDerrota(muerte);
    a.reloj.avanzar(1500);
    expect(a.reloj.tareas[0].callback.call(b.api, { pendiente: true }))
      .toEqual(aceptada('derrota'));
    expect(a.api.getEstado()).toBe('derrota');
    expect(a.efectos.terminal).toHaveBeenCalledTimes(1);
    expect(b.api.getEstado()).toBe('jugando');
    expect(b.reloj.tareas).toHaveLength(0);
    for (const efecto of Object.values(b.efectos)) expect(efecto).not.toHaveBeenCalled();
  });
});
