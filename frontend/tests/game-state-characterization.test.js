import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/main.js', import.meta.url),
  'utf8'
);

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
