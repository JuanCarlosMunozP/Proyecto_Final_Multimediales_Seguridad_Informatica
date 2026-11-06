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
    expect(transicionar(ESTADOS.JUGANDO, 'WIN').estado)
      .toBe(ESTADOS.VICTORIA);
    expect(transicionar(ESTADOS.JUGANDO, 'LOSE').estado)
      .toBe(ESTADOS.DERROTA);
  });

  it('TC-FSM-110: iniciar con cinematica activa', () => {
    expect(transicionar(ESTADOS.INICIO, 'START', {
      cineActivo: true,
    }).estado).toBe(ESTADOS.CINEMATICA);
  });

  it('TC-FSM-111: modo demostracion', () => {
    expect(transicionar(ESTADOS.CARGANDO, 'DEMO_START').estado)
      .toBe(ESTADOS.JUGANDO);
  });
});
