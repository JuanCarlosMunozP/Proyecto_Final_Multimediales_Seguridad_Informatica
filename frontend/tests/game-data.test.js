import { describe, expect, it } from 'vitest';
import {
  NIVELES,
  GUIONES,
  CINEMATICAS,
  IDOLOS_POR_NIVEL,
} from '../src/juego/datos.js';
import { TEMAS } from '../src/escenario/temas.js';

describe('Datos y niveles del videojuego', () => {
  it('TC-DATA-001: conserva tres niveles y tres biomas', () => {
    expect(NIVELES).toHaveLength(3);
    expect(TEMAS).toHaveLength(3);
  });

  it('TC-DATA-002: cada nivel tiene un guion', () => {
    expect(GUIONES).toHaveLength(NIVELES.length);
    expect(GUIONES.every((guion) => guion.length > 0)).toBe(true);
  });

  it('TC-DATA-003: conserva las cinematicas del primer nivel', () => {
    expect(CINEMATICAS[0][1]).toBe('avion');
    expect(CINEMATICAS[0][2]).toBe('playa');
  });

  it('TC-DATA-004: conserva dos idolos por nivel', () => {
    expect(IDOLOS_POR_NIVEL).toBe(2);
  });
});
