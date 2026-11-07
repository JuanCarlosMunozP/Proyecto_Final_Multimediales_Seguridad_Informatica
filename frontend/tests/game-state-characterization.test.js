import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { afterEach, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { ESTADOS, transicionar } from '../src/juego/game-state-machine.js';

const source = readFileSync(
  new URL('../src/main.js', import.meta.url),
  'utf8'
);

// Ejecuta declaraciones originales; no carga navegador, render ni listeners.
function extraerFuncion(nombre) {
  const inicio = source.indexOf(`function ${nombre}(`);
  const fin = source.indexOf('\n}', inicio);
  if (inicio < 0 || fin < 0) throw new Error(`Función no encontrada: ${nombre}`);
  return source.slice(inicio, fin + 2);
}

describe('Derrota diferida real (RF-005, ADR-002)', () => {
  afterEach(() => vi.useRealTimers());

  it('TC-FSM-007: derrota pendiente finaliza después de pausar', () => {
    vi.useFakeTimers();
    const pantallaFinal = vi.fn();
    const document = { exitPointerLock: vi.fn() };
    const jugador = { vivo: true };
    const axel = { morir: vi.fn() };
    const sonido = { derrota: vi.fn() };
    const quitarOculta = vi.fn();
    const hud = {
      titulo: {}, texto: {}, boton: {},
      pantalla: { classList: { remove: quitarOculta } },
    };
    const api = runInNewContext(`
      let estado = 'jugando';
      ${extraerFuncion('matarJugador')}
      ${extraerFuncion('pausar')}
      ${extraerFuncion('terminar')}
      ({ matarJugador, pausar, leerEstado: () => estado });
    `, {
      jugador, axel, sonido, hud, document, pantallaFinal,
      dispositivo: { tactil: false }, tiempoFinal: 12.4,
      NIVELES: [{}, {}, {}], setTimeout,
    });
    api.matarJugador('impacto');
    expect(jugador.vivo).toBe(false);
    expect(axel.morir).toHaveBeenCalledWith(undefined, 'impacto');
    expect(sonido.derrota).toHaveBeenCalledTimes(1);
    api.pausar();
    expect(api.leerEstado()).toBe('pausa');
    expect(quitarOculta).toHaveBeenCalledWith('oculta');
    vi.advanceTimersByTime(1499);
    expect(api.leerEstado()).toBe('pausa');
    expect(pantallaFinal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(api.leerEstado()).toBe('derrota');
    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
    expect(pantallaFinal).toHaveBeenCalledExactlyOnceWith('derrota', 12, 3);
    // Discrepancia explícita: la FSM aislada aún rechaza derrota desde pausa.
    expect(transicionar(ESTADOS.PAUSA, 'LOSE')).toEqual({
      aceptada: false, estado: ESTADOS.PAUSA,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });
});

describe('Caracterizacion de la FSM actual', () => {
  it('TC-FSM-001: inicia en cargando', () => {
    expect(source).toMatch(
      /let\s+estado\s*=\s*["']cargando["']/
    );
  });

  it('TC-FSM-002: contempla el estado inicio', () => {
    expect(source).toMatch(
      /estado\s*=\s*["']inicio["']/
    );
  });

  it('TC-FSM-003: implementa una funcion de pausa', () => {
    expect(source).toMatch(
      /function\s+pausar\s*\(\s*\)/
    );
    expect(source).toMatch(
      /estado\s*=\s*["']pausa["']/
    );
  });

  it('TC-FSM-004: reanuda segun la cinematica activa', () => {
    expect(source).toMatch(
      /estado\s*=\s*cine\s*\?\s*["']cinematica["']\s*:\s*["']jugando["']/
    );
  });

  it('TC-FSM-005: permite finalizar una cinematica', () => {
    expect(source).toMatch(
      /cine\s*=\s*null;\s*estado\s*=\s*["']jugando["']/
    );
  });

  it('TC-FSM-006: mantiene el bucle de renderizado', () => {
    expect(source).toContain('requestAnimationFrame(animar)');
    expect(source).toContain('renderer.render(scene, camera)');
  });
});
