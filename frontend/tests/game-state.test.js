import { describe, expect, it } from 'vitest';
import {
  ESTADOS,
  transicionar,
} from '../src/juego/game-state-machine.js';

describe('FSM: transiciones de estados', () => {
  it('TC-FSM-101: carga normal', () => {
    expect(transicionar(ESTADOS.CARGANDO, 'LOAD_COMPLETE'))
      .toEqual({ aceptada: true, estado: ESTADOS.INICIO });
  });

  it('TC-FSM-102: inicio de partida', () => {
    expect(transicionar(ESTADOS.INICIO, 'START'))
      .toEqual({ aceptada: true, estado: ESTADOS.JUGANDO });
  });

  it('TC-FSM-103: pausa durante partida', () => {
    expect(transicionar(ESTADOS.JUGANDO, 'PAUSE'))
      .toEqual({ aceptada: true, estado: ESTADOS.PAUSA });
  });

  it('TC-FSM-104: reanudar partida', () => {
    expect(transicionar(ESTADOS.PAUSA, 'RESUME'))
      .toEqual({ aceptada: true, estado: ESTADOS.JUGANDO });
  });

  it('TC-FSM-105: pausa de cinematica', () => {
    expect(transicionar(ESTADOS.CINEMATICA, 'PAUSE'))
      .toEqual({ aceptada: true, estado: ESTADOS.PAUSA });
  });

  it('TC-FSM-106: reanudar cinematica activa', () => {
    expect(transicionar(ESTADOS.PAUSA, 'RESUME', {
      cineActivo: true,
    })).toEqual({
      aceptada: true,
      estado: ESTADOS.CINEMATICA,
    });
  });

  it('TC-FSM-107: finalizar cinematica', () => {
    expect(transicionar(ESTADOS.CINEMATICA, 'CINEMATIC_END'))
      .toEqual({ aceptada: true, estado: ESTADOS.JUGANDO });
  });

  it('TC-FSM-108: rechazar transicion invalida', () => {
    expect(transicionar(ESTADOS.VICTORIA, 'PAUSE'))
      .toEqual({
        aceptada: false,
        estado: ESTADOS.VICTORIA,
        motivo: 'TRANSICION_NO_PERMITIDA',
      });
  });

  it('TC-FSM-109: victoria y derrota', () => {
    expect(transicionar(ESTADOS.JUGANDO, 'WIN'))
      .toEqual({ aceptada: true, estado: ESTADOS.VICTORIA });
    expect(transicionar(ESTADOS.JUGANDO, 'LOSE'))
      .toEqual({ aceptada: true, estado: ESTADOS.DERROTA });
  });

  it('TC-FSM-110: iniciar con cinematica activa', () => {
    expect(transicionar(ESTADOS.INICIO, 'START', {
      cineActivo: true,
    })).toEqual({ aceptada: true, estado: ESTADOS.CINEMATICA });
  });

  it('TC-FSM-111: modo demostracion', () => {
    expect(transicionar(ESTADOS.CARGANDO, 'DEMO_START'))
      .toEqual({ aceptada: true, estado: ESTADOS.JUGANDO });
  });
});

// ADR-002: rechazo de eventos no autorizados y estado válido.
const rechazo = (estado, motivo = 'TRANSICION_NO_PERMITIDA') => ({
  aceptada: false, estado, motivo,
});
const eventos = [
  'LOAD_COMPLETE', 'DEMO_START', 'START', 'PAUSE', 'START_CINEMATIC',
  'WIN', 'LOSE', 'CINEMATIC_END', 'RESUME',
];
const permitidos = {
  cargando: ['LOAD_COMPLETE', 'DEMO_START'], inicio: ['START'],
  jugando: ['PAUSE', 'START_CINEMATIC', 'WIN', 'LOSE'],
  cinematica: ['PAUSE', 'CINEMATIC_END'], pausa: ['RESUME'],
  victoria: [], derrota: [],
};

describe('FSM: contrato y límites de entrada (ADR-002)', () => {
  it('TC-FSM-112: iniciar cinematica durante juego', () => {
    expect(transicionar(ESTADOS.JUGANDO, 'START_CINEMATIC'))
      .toEqual({ aceptada: true, estado: ESTADOS.CINEMATICA });
  });

  it.each(Object.values(ESTADOS).flatMap((estado) =>
    eventos.filter((evento) => !permitidos[estado].includes(evento))
      .map((evento) => [estado, evento])
  ))('TC-FSM-113: rechaza par no autorizado %s / %s', (estado, evento) => {
    expect(transicionar(estado, evento)).toEqual(rechazo(estado));
  });

  it.each(['toString', 'constructor', '__proto__'])
  ('TC-FSM-114: rechaza evento heredado %s en todos los estados', (evento) => {
    for (const estado of Object.values(ESTADOS)) {
      expect(transicionar(estado, evento)).toEqual(rechazo(estado));
    }
  });

  it.each(['desconocido', '', 'toString', 'constructor', '__proto__',
    null, undefined, 0, true, Symbol('jugando'), ['jugando'],
    new String('jugando'), { toString: () => 'jugando' }])
  ('TC-FSM-115: rechaza estado no válido %#', (estado) => {
    expect(transicionar(estado, 'PAUSE')).toEqual(rechazo(estado));
  });

  it.each(['desconocido', '', null, undefined, 0, true, Symbol('PAUSE'),
    ['PAUSE'], new String('PAUSE'), { toString: () => 'PAUSE' }])
  ('TC-FSM-116: rechaza evento no válido %#', (evento) => {
    expect(transicionar(ESTADOS.JUGANDO, evento)).toEqual(rechazo(ESTADOS.JUGANDO));
  });

  it.each([null, [], 'texto', 0, true, () => {},
    { cineActivo: null }, { cineActivo: 0 }, { cineActivo: 'false' },
    { cineActivo: new Boolean(false) }])
  ('TC-FSM-117: rechaza contexto inválido %# sin lanzar', (contexto) => {
    expect(transicionar(ESTADOS.INICIO, 'START', contexto))
      .toEqual(rechazo(ESTADOS.INICIO, 'CONTEXTO_INVALIDO'));
  });

  it.each([['inicio', 'START'], ['pausa', 'RESUME']])
  ('TC-FSM-118: contexto booleano y no mutación %s / %s', (estado, evento) => {
    for (const cineActivo of [false, true]) {
      const contexto = Object.freeze({ cineActivo, extra: Object.freeze({ valor: 1 }) });
      expect(transicionar(estado, evento, contexto)).toEqual({
        aceptada: true, estado: cineActivo ? ESTADOS.CINEMATICA : ESTADOS.JUGANDO,
      });
      expect(contexto).toEqual({ cineActivo, extra: { valor: 1 } });
    }
  });

  it('TC-FSM-119: no coacciona objetos de estado o evento', () => {
    const entrada = { [Symbol.toPrimitive]() { throw new Error('No debe coercionar'); } };
    expect(transicionar(entrada, 'PAUSE')).toEqual(rechazo(entrada));
    expect(transicionar(ESTADOS.JUGANDO, entrada)).toEqual(rechazo(ESTADOS.JUGANDO));
  });

  it('TC-FSM-120: contexto opcional y precedencia de rechazo', () => {
    expect(transicionar(ESTADOS.INICIO, 'START', { cineActivo: undefined }))
      .toEqual({ aceptada: true, estado: ESTADOS.JUGANDO });
    expect(transicionar(ESTADOS.VICTORIA, 'PAUSE', null))
      .toEqual(rechazo(ESTADOS.VICTORIA));
  });
});
