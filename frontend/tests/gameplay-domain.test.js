import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { crearFrio } from '../src/juego/frio.js';
import { ARMAS, armaAleatoria, armaDeKit, zonaDeBala } from '../src/personajes/armas.js';
import { objetivos, NIVELES, IDOLOS_POR_NIVEL, METROS_NADO } from '../src/juego/datos.js';
import { altura, usarBioma, OASIS } from '../src/escenario/terreno.js';
import { TEMAS } from '../src/escenario/temas.js';
import { crearAgua } from '../src/escenario/agua.js';
import { Enemigo } from '../src/personajes/enemigo.js';

describe('Reglas de dominio del gameplay: frío, armas, terreno, agua y misiones', () => {
  it('TC-DOM-001: objetivos por nivel validan ídolos, mercenarios y extras por bioma', () => {
    const base = { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 };
    expect(objetivos(0, base)).toHaveLength(3);
    expect(objetivos(1, base)).toHaveLength(4);
    expect(objetivos(2, base)).toHaveLength(3);

    const n0Ok = objetivos(0, { ...base, idolos: IDOLOS_POR_NIVEL, derrotados: NIVELES[0].enemigos, altar: true });
    expect(n0Ok.every(([, ok]) => ok)).toBe(true);

    const n1Ok = objetivos(1, { ...base, idolos: IDOLOS_POR_NIVEL, derrotados: NIVELES[1].enemigos, altar: true, fogata: true });
    expect(n1Ok.every(([, ok]) => ok)).toBe(true);

    const n2Ok = objetivos(2, { ...base, idolos: IDOLOS_POR_NIVEL, derrotados: NIVELES[2].enemigos, nado: METROS_NADO });
    expect(n2Ok.every(([, ok]) => ok)).toBe(true);
  });

  it('TC-DOM-002: sistema de frío y calor en montaña aplica congelación y recuperación junto al fuego', () => {
    const f = crearFrio();
    f.reiniciar(false);
    expect(f.actualizar(10, false)).toBe(0);

    f.reiniciar(true);
    for (let i = 0; i < 40; i++) f.actualizar(1, false);
    expect(f.congelando).toBe(true);
    expect(f.actualizar(1, false)).toBe(3);

    f.actualizar(2, true);
    expect(f.calor).toBeGreaterThan(0);
    expect(f.frio).toBeLessThan(100);
    expect(f.congelando).toBe(false);
  });

  it('TC-DOM-003: catálogo de armas y localización de impacto de bala (zonaDeBala)', () => {
    expect(ARMAS.puños.dano).toBeLessThan(ARMAS.cuchillo.dano);
    expect(ARMAS.cuchillo.dano).toBeLessThan(ARMAS.machete.dano);
    expect(ARMAS.machete.dano).toBeLessThan(ARMAS.bate.dano);

    for (let i = 0; i < 30; i++) {
      expect(armaDeKit().id).not.toBe('puños');
      expect(ARMAS).toHaveProperty(armaAleatoria().id);
    }

    expect(zonaDeBala(1.7).mortal).toBe(true);
    expect(zonaDeBala(1.3, 0).mortal).toBe(true);
    expect(zonaDeBala(1.3, 0.35).mortal).toBeUndefined();
    expect(zonaDeBala(1.3, 0.35)).toMatchObject({ dano: 10, herida: { parte: 'brazo', lado: 'I' } });
    expect(zonaDeBala(1.0, 0)).toMatchObject({ dano: 20, herida: { parte: 'abdomen' } });
    expect(zonaDeBala(0.45, -0.1)).toMatchObject({ dano: 10, herida: { parte: 'rodilla', lado: 'D' } });
    expect(zonaDeBala(0.2, 0)).toMatchObject({ dano: 10, herida: { parte: 'pierna' } });
  });

  it('TC-DOM-004: terreno de los 3 biomas tiene spawn en tierra firme y oasis navegable en desierto', () => {
    for (const tema of TEMAS) {
      usarBioma(tema);
      const hSpawn = altura(tema.spawn.x, tema.spawn.z);
      expect(Number.isFinite(hSpawn)).toBe(true);
      expect(hSpawn).toBeGreaterThan(0.4);
    }

    usarBioma(TEMAS[2]); // Desierto
    const aguaOasis = crearAgua('oasis', altura);
    expect(altura(OASIS.x, OASIS.z)).toBeLessThan(-1.5);
    expect(aguaOasis.contiene(OASIS.x, OASIS.z, false)).toBe(true);
    expect(aguaOasis.contiene(TEMAS[2].spawn.x, TEMAS[2].spawn.z, false)).toBe(false);
  });

  it('TC-DOM-005: proyectiles enemigos se detienen ante obstáculos sólidos y no atraviesan muros/altares ([MM-P0-01])', () => {
    const scene = new THREE.Scene();
    const jugador = { pos: new THREE.Vector3(0, 0, 4), vivo: true, direccion: 0 };
    const crearBala = () => {
      const mesh = new THREE.Mesh();
      mesh.position.set(0, 1.3, 0);
      scene.add(mesh);
      return { mesh, vel: new THREE.Vector3(0, 0, 20), vida: 1.5 };
    };

    // Caso 1: Obstáculo sólido (ej. altar/columna en z=2) entre el disparo y Max
    let golpesConObstaculo = 0;
    const ctxBloqueado = {
      scene,
      mundo: { altura: () => 0, obstaculos: [{ x: 0, z: 2, r: 1.2 }] },
      balas: [crearBala()]
    };
    Enemigo.prototype.actualizarBalas.call(ctxBloqueado, 0.2, jugador, () => { golpesConObstaculo++; });
    expect(golpesConObstaculo).toBe(0);
    expect(ctxBloqueado.balas).toHaveLength(0);

    // Caso 2: Línea de tiro despejada impacta a Max
    let golpesSinObstaculo = 0;
    const ctxDespejado = {
      scene,
      mundo: { altura: () => 0, obstaculos: [] },
      balas: [crearBala()]
    };
    Enemigo.prototype.actualizarBalas.call(ctxDespejado, 0.2, jugador, () => { golpesSinObstaculo++; });
    expect(golpesSinObstaculo).toBe(1);
    expect(ctxDespejado.balas).toHaveLength(0);
  });
});
