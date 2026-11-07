import { describe, expect, it, vi } from 'vitest';
import { crearAdaptadores } from '../src/juego/game-state-adapters.js';
import { crearCoordinador } from '../src/juego/game-state-coordinator.js';

// Dependencias manuales: no timers reales; conserva callbacks para entrega tardía.
function preparar() {
  let tiempo = 0;
  const tareas = [];
  const fallos = { programar: false, despuesDeGuardar: false, cancelar: false, reloj: false };
  const hooks = { cancelar: null, programar: null, ahora: null };
  const efectos = { muerte: vi.fn(), transicion: vi.fn(), terminal: vi.fn() };
  const api = crearAdaptadores({
    ahora: () => {
      hooks.ahora?.();
      if (fallos.reloj) throw new Error('reloj roto');
      return tiempo;
    },
    programar(callback, demora) {
      if (fallos.programar) throw new Error('scheduler roto');
      const tarea = { callback, demora, vence: tiempo + demora, cancelada: false };
      tareas.push(tarea);
      hooks.programar?.();
      if (fallos.despuesDeGuardar) throw new Error('scheduler guardó antes de fallar');
      return tarea;
    },
    cancelar(tarea) {
      hooks.cancelar?.();
      if (fallos.cancelar) throw new Error('cancelación rota');
      tarea.cancelada = true;
    },
    efectos,
  });
  const iniciar = () => { api.despachar('LOAD_COMPLETE'); api.despachar('START'); };
  iniciar();
  efectos.transicion.mockClear();
  return {
    api, tareas, fallos, hooks, efectos, iniciar,
    avanzar: (ms) => { tiempo += ms; },
    tiempo: (valor) => { tiempo = valor; },
    disparar: (indice) => tareas[indice].callback(),
  };
}
const muerte = { vida: 0, vivo: false };
const aceptada = (estado) => ({ aceptada: true, estado });

function diagnostico(api, operacion, motivo) {
  expect(api.getErrores()).toContainEqual({ operacion, motivo });
}

describe('Recuperación aislada: fallos y reentrada (POL-FSM-001 A)', () => {
  it('TC-REC-001: fallo inicial scheduler conserva muerte y plazo, recuperación explícita', () => {
    const h = preparar();
    h.fallos.programar = true;
    expect(h.api.programarDerrota(muerte)).toEqual(aceptada('jugando'));
    expect(h.tareas).toHaveLength(0);
    diagnostico(h.api, 'programar', 'SCHEDULER_ERROR');
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    h.avanzar(1000);
    expect(h.api.recuperar()).toEqual({ aceptada: false, estado: 'jugando', motivo: 'SCHEDULER_ERROR' });
    h.fallos.programar = false;
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas[0].demora).toBe(500);
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas).toHaveLength(1);
    h.avanzar(500);
    expect(h.disparar(0)).toEqual(aceptada('derrota'));
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-002: fallo al reintentar temprano conserva plazo y versión', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.avanzar(1000);
    h.fallos.programar = true;
    expect(h.disparar(0)).toEqual({ aceptada: false, estado: 'jugando', motivo: 'DERROTA_NO_VENCIDA' });
    diagnostico(h.api, 'programar', 'SCHEDULER_ERROR');
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    h.fallos.programar = false;
    h.avanzar(400);
    h.api.recuperar();
    expect(h.tareas[1].demora).toBe(100);
    h.avanzar(100);
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
    expect(h.disparar(1).aceptada).toBe(false);
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-003: excepción al cancelar no pierde victoria ni permite callback tardío', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.fallos.cancelar = true;
    expect(h.api.despachar('WIN')).toEqual(aceptada('victoria'));
    diagnostico(h.api, 'cancelar', 'CANCELACION_ERROR');
    expect(h.efectos.terminal).toHaveBeenCalledExactlyOnceWith(aceptada('victoria'));
    h.avanzar(1500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.api.getEstado()).toBe('victoria');
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it.each(['terminal', 'muerte', 'transicion'])
  ('TC-REC-004: efecto %s que lanza se diagnostica sin repetición ciega', (nombre) => {
    const h = preparar();
    const accionesParciales = [];
    h.efectos[nombre].mockImplementation(() => {
      accionesParciales.push(nombre);
      throw new Error('efecto parcial');
    });
    if (nombre === 'transicion') h.api.perderPuntero();
    if (nombre !== 'transicion') h.api.programarDerrota(muerte);
    if (nombre === 'terminal') {
      h.avanzar(1500);
      expect(h.disparar(0)).toEqual(aceptada('derrota'));
      expect(h.disparar(0).aceptada).toBe(false);
    }
    diagnostico(h.api, nombre, 'EFECTO_ERROR');
    h.api.recuperar();
    expect(h.efectos[nombre]).toHaveBeenCalledTimes(1);
    expect(accionesParciales).toEqual([nombre]);
    if (nombre === 'muerte') {
      h.avanzar(1500);
      expect(h.disparar(0)).toEqual(aceptada('derrota'));
    }
  });

  it('TC-REC-005: reset/inicio reentrante al cancelar impide terminal antiguo', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.hooks.cancelar = () => { h.api.reiniciarPartida(); h.iniciar(); };
    h.api.despachar('WIN');
    expect(h.api.getEstado()).toBe('jugando');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    h.avanzar(1500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.api.getEstado()).toBe('jugando');
  });

  it.each(['NaN', 'excepción'])
  ('TC-REC-006: reloj inválido %s al resolver recupera pendiente sin reiniciar plazo', (tipo) => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    if (tipo === 'NaN') h.tiempo(NaN);
    else h.fallos.reloj = true;
    expect(h.disparar(0)).toEqual({ aceptada: false, estado: 'jugando', motivo: 'RELOJ_INVALIDO' });
    expect(h.api.recuperar().motivo).toBe('RELOJ_INVALIDO');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    h.fallos.reloj = false;
    h.tiempo(1400);
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas[1].demora).toBe(100);
    h.avanzar(100);
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-007: resolución desde cine rechaza, retiene pendiente y recupera en juego', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.api.despachar('START_CINEMATIC');
    h.avanzar(1500);
    expect(h.disparar(0)).toEqual({ aceptada: false, estado: 'cinematica', motivo: 'TRANSICION_NO_PERMITIDA' });
    expect(h.api.recuperar().motivo).toBe('TRANSICION_NO_PERMITIDA');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    h.api.finalizarCinematica();
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas[1].demora).toBe(1);
    h.avanzar(1);
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
  });

  it('TC-REC-008: reset tras fallo invalida callback y capacidad de recuperación antiguos', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.fallos.reloj = true;
    h.disparar(0);
    h.fallos.reloj = false;
    h.api.reiniciarPartida();
    h.iniciar();
    expect(h.api.recuperar().motivo).toBe('SIN_DERROTA_PENDIENTE');
    h.api.programarDerrota(muerte);
    h.avanzar(1500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it.each(['programar', 'ahora'])
  ('TC-REC-009: reentrada desde %s no entrega muerte o terminal de partida antigua', (nombre) => {
    const h = preparar();
    h.hooks[nombre] = () => {
      h.hooks[nombre] = null;
      h.api.reiniciarPartida();
      h.iniciar();
    };
    h.api.programarDerrota(muerte);
    expect(h.api.getEstado()).toBe('jugando');
    expect(h.efectos.muerte).not.toHaveBeenCalled();
    h.avanzar(1500);
    for (const tarea of h.tareas) expect(tarea.callback().aceptada).toBe(false);
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    expect(h.api.recuperar().motivo).toBe('SIN_DERROTA_PENDIENTE');
  });

  it('TC-REC-010: diagnósticos son snapshot y no permiten modificar registro interno', () => {
    const h = preparar();
    h.fallos.programar = true;
    h.api.programarDerrota(muerte);
    const copia = h.api.getErrores();
    expect(copia).toContainEqual({ operacion: 'programar', motivo: 'SCHEDULER_ERROR' });
    expect(Object.keys(copia[0]).sort()).toEqual(['motivo', 'operacion']);
    try { copia[0].motivo = 'alterado'; copia.length = 0; } catch { /* Snapshot congelado también válido. */ }
    diagnostico(h.api, 'programar', 'SCHEDULER_ERROR');
  });

  it('TC-REC-011: scheduler que guarda y lanza no deja callback autorizado antiguo', () => {
    const h = preparar();
    h.fallos.despuesDeGuardar = true;
    h.api.programarDerrota(muerte);
    expect(h.tareas).toHaveLength(1);
    h.fallos.despuesDeGuardar = false;
    h.avanzar(1000);
    h.api.recuperar();
    expect(h.tareas[1].demora).toBe(500);
    h.avanzar(500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-012: reentrada desde reloj al resolver no finaliza nueva partida', () => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.avanzar(1500);
    h.hooks.ahora = () => {
      h.hooks.ahora = null;
      h.api.reiniciarPartida();
      h.iniciar();
    };
    expect(h.disparar(0).aceptada).toBe(false);
    expect(h.api.getEstado()).toBe('jugando');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    expect(h.api.recuperar().motivo).toBe('SIN_DERROTA_PENDIENTE');
  });

  it('TC-REC-013: ledger terminal permite exactamente un efecto en cada partida', () => {
    const h = preparar();
    expect(h.api.despachar('WIN')).toEqual(aceptada('victoria'));
    expect(h.api.despachar('WIN').aceptada).toBe(false);
    h.api.reiniciarPartida();
    h.iniciar();
    h.api.programarDerrota(muerte);
    h.avanzar(1500);
    expect(h.disparar(0)).toEqual(aceptada('derrota'));
    expect(h.disparar(0).aceptada).toBe(false);
    expect(h.efectos.terminal.mock.calls).toEqual([
      [aceptada('victoria')], [aceptada('derrota')],
    ]);
  });

  it('TC-REC-014: entrega síncrona no deja tarea ficticia y permite recuperar', () => {
    const h = preparar();
    h.hooks.programar = () => {
      h.hooks.programar = null;
      expect(h.tareas.at(-1).callback().motivo).toBe('CALLBACK_SINCRONO');
    };
    expect(h.api.programarDerrota(muerte)).toEqual(aceptada('jugando'));
    diagnostico(h.api, 'programar', 'CALLBACK_SINCRONO');
    expect(h.tareas[0].cancelada).toBe(true);
    h.avanzar(1000);
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas[1].demora).toBe(500);
    h.avanzar(500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.disparar(1)).toEqual(aceptada('derrota'));
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it.each(['muerte', 'transicion', 'terminal'])
  ('TC-REC-015: efecto %s que reinicia no deja trabajo viejo sobre nueva partida', (nombre) => {
    const h = preparar();
    let reiniciado = false;
    h.efectos[nombre].mockImplementation(() => {
      if (reiniciado) return;
      reiniciado = true;
      h.api.reiniciarPartida();
      h.iniciar();
    });
    if (nombre === 'transicion') h.api.perderPuntero();
    else {
      h.api.programarDerrota(muerte);
      if (nombre === 'terminal') {
        h.avanzar(1500);
        h.disparar(0);
      }
    }
    expect(reiniciado).toBe(true);
    expect(h.api.getEstado()).toBe('jugando');
    for (const tarea of h.tareas) expect(tarea.callback().aceptada).toBe(false);
    expect(h.api.recuperar().motivo).toBe('SIN_DERROTA_PENDIENTE');
    expect(h.efectos.terminal).toHaveBeenCalledTimes(nombre === 'terminal' ? 1 : 0);
  });

  it.each(['reiniciarPartida', 'destruir'])
  ('TC-REC-016: cancelador que falla durante %s deja callbacks antiguos inocuos', (metodo) => {
    const h = preparar();
    h.api.programarDerrota(muerte);
    h.fallos.cancelar = true;
    expect(h.api[metodo]().aceptada).toBe(true);
    diagnostico(h.api, 'cancelar', 'CANCELACION_ERROR');
    h.avanzar(1500);
    expect(h.disparar(0).motivo).toBe('CALLBACK_NO_VIGENTE');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    if (metodo === 'reiniciarPartida') {
      h.iniciar();
      expect(h.api.recuperar().motivo).toBe('SIN_DERROTA_PENDIENTE');
    } else {
      expect(h.api.despachar('WIN').motivo).toBe('ADAPTADOR_DESTRUIDO');
    }
  });

  it('TC-REC-017: excepción inicial de reloj no registra una muerte irrecuperable', () => {
    const h = preparar();
    h.fallos.reloj = true;
    expect(h.api.programarDerrota(muerte).motivo).toBe('RELOJ_INVALIDO');
    expect(h.tareas).toHaveLength(0);
    expect(h.efectos.muerte).not.toHaveBeenCalled();
    h.fallos.reloj = false;
    expect(h.api.programarDerrota(muerte)).toEqual(aceptada('jugando'));
    h.avanzar(1500);
    expect(h.disparar(0)).toEqual(aceptada('derrota'));
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-018: coordinador directo captura reloj que lanza sin depender del wrapper', () => {
    let roto = true;
    const c = crearCoordinador({ ahora: () => {
      if (roto) throw new Error('reloj directo');
      return 0;
    } });
    c.despachar('LOAD_COMPLETE');
    c.despachar('START');
    expect(c.programarDerrota(muerte).motivo).toBe('RELOJ_INVALIDO');
    roto = false;
    expect(c.programarDerrota(muerte).aceptada).toBe(true);
  });

  it('TC-REC-019: coordinador directo revalida partida después del reloj al registrar', () => {
    let hook;
    const c = crearCoordinador({ ahora: () => { hook?.(); return 0; } });
    const iniciar = () => { c.despachar('LOAD_COMPLETE'); c.despachar('START'); };
    iniciar();
    hook = () => {
      hook = null;
      c.reiniciarPartida();
      iniciar();
    };
    expect(c.programarDerrota(muerte).motivo).toBe('OPERACION_OBSOLETA');
    expect(c.getEstado()).toBe('jugando');
    expect(c.programarDerrota(muerte).aceptada).toBe(true);
  });

  it('TC-REC-020: coordinador directo no consume nueva capacidad desde resolución vieja', () => {
    let tiempo = 0;
    let hook;
    const c = crearCoordinador({ ahora: () => { hook?.(); return tiempo; } });
    const iniciar = () => { c.despachar('LOAD_COMPLETE'); c.despachar('START'); };
    iniciar();
    const vieja = c.programarDerrota(muerte);
    let nueva;
    tiempo = 1500;
    hook = () => {
      hook = null;
      c.reiniciarPartida();
      iniciar();
      nueva = c.programarDerrota(muerte);
    };
    expect(vieja.resolver().motivo).toBe('DERROTA_NO_VIGENTE');
    expect(c.getEstado()).toBe('jugando');
    expect(nueva.resolver().motivo).toBe('DERROTA_NO_VENCIDA');
    tiempo = 3000;
    expect(nueva.resolver()).toEqual(aceptada('derrota'));
  });

  it('FSM-010-001: pausa reentrante al programar conserva un intento de muerte y el plazo', () => {
    const h = preparar();
    h.hooks.programar = () => {
      h.hooks.programar = null;
      expect(h.api.perderPuntero()).toEqual(aceptada('pausa'));
    };
    expect(h.api.programarDerrota(muerte).aceptada).toBe(true);
    expect(h.api.getEstado()).toBe('pausa');
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    h.avanzar(1000);
    expect(h.api.recuperar()).toEqual(aceptada('pausa'));
    expect(h.tareas.at(-1).vence).toBe(1500);
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    h.avanzar(500);
    for (const tarea of h.tareas) tarea.callback();
    expect(h.api.getEstado()).toBe('derrota');
    expect(h.efectos.terminal).toHaveBeenCalledExactlyOnceWith(aceptada('derrota'));
    for (const tarea of h.tareas) expect(tarea.callback().aceptada).toBe(false);
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });

  it('FSM-010-002: recuperar reentrante desde reloj conserva una agenda cancelable', () => {
    const h = preparar();
    h.fallos.programar = true;
    expect(h.api.programarDerrota(muerte)).toEqual(aceptada('jugando'));
    h.fallos.programar = false;
    h.avanzar(1000);
    h.hooks.ahora = () => {
      h.hooks.ahora = null;
      h.api.recuperar();
    };
    expect(h.api.recuperar()).toEqual(aceptada('jugando'));
    expect(h.tareas).toHaveLength(1);
    expect(h.tareas[0].demora).toBe(500);
    expect(h.tareas[0].vence).toBe(1500);
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    expect(h.api.destruir().aceptada).toBe(true);
    expect(h.tareas.every((tarea) => tarea.cancelada)).toBe(true);
    h.avanzar(500);
    for (const tarea of h.tareas) expect(tarea.callback().aceptada).toBe(false);
    expect(h.api.getEstado()).toBe('jugando');
    expect(h.efectos.terminal).not.toHaveBeenCalled();
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
  });

  it('TC-REC-021: recuperar reentrante durante programación no crea agendas recursivas', () => {
    const h = preparar();
    h.hooks.programar = () => {
      expect(h.api.recuperar().motivo).toBe('SCHEDULER_OCUPADO');
    };
    h.api.programarDerrota(muerte);
    expect(h.tareas).toHaveLength(1);
    expect(h.tareas[0].demora).toBe(1500);
    h.avanzar(1500);
    expect(h.disparar(0)).toEqual(aceptada('derrota'));
    expect(h.efectos.muerte).toHaveBeenCalledTimes(1);
    expect(h.efectos.terminal).toHaveBeenCalledTimes(1);
  });
});
