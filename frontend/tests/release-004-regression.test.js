import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { Enemigo } from '../src/personajes/enemigo.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const combate = readFileSync(new URL('../src/juego/combate.js', import.meta.url), 'utf8');
function funcion(source, nombre) {
  const inicio = source.indexOf(`function ${nombre}(`);
  const fin = source.indexOf('\n}', inicio);
  if (inicio < 0 || fin < 0) throw new Error(`No se encontró ${nombre}`);
  const async = source.slice(Math.max(0, inicio - 6), inicio) === 'async ';
  return `${async ? 'async ' : ''}${source.slice(inicio, fin + 2)}`;
}

// Reloj manual; no setTimeout nativo, navegador, carga de GLB ni integración FSM.
function prepararNivel() {
  let tiempo = 0, completar;
  const tareas = [];
  const carga = new Promise((resolve) => { completar = resolve; });
  const jugador = { vivo: true, vida: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  const pantallaFinal = vi.fn();
  const clases = { toggle: vi.fn(), remove: vi.fn() };
  const hud = { titulo: {}, texto: {}, boton: {}, pantalla: { classList: clases },
    filaFrio: { classList: clases }, filaCalor: { classList: clases } };
  const api = runInNewContext(`
    let estado = 'jugando', cambiandoNivel = false, nivel = 0;
    let metaLista = false, misionesAceptadas = false, dialogo = null, daniel = null;
    ${['matarJugador', 'pausar', 'terminar', 'empezarNivel'].map((n) => funcion(main, n)).join('\n')}
    ({ matarJugador, pausar, empezarNivel, estado: () => estado });
  `, {
    jugador, hud, pantallaFinal, tiempoFinal: 10, dispositivo: { tactil: false },
    axel: { morir: vi.fn() }, sonido: { derrota: vi.fn() },
    document: { exitPointerLock: vi.fn(), getElementById: () => ({}) },
    setTimeout: (callback, demora) => {
      const tarea = { callback, vence: tiempo + demora, cancelada: false };
      tareas.push(tarea); return tarea;
    },
    clearTimeout: (tarea) => { tarea.cancelada = true; },
    cuenta: { guardarNivel: vi.fn() }, NIVELES: [{ enemigos: 0 }, { enemigos: 0 }],
    cargarMundo: () => carga, obj: {}, suministros: { reiniciar: vi.fn() },
    enemigos: [], CASAS: [], scene: { remove: vi.fn(), add: vi.fn() },
    crearDaniel: () => ({ grupo: { position: new THREE.Vector3() } }),
    clonarModelo: () => ({}), modeloEnemigo: {}, danielPos: new THREE.Vector3(),
    mundo: { spawn: { x: 0, z: 0 }, altura: () => 0, obstaculos: [], tema: {} },
    cerrarDialogo: vi.fn(), frio: { reiniciar: vi.fn(), activo: false },
    precalentar: async () => {},
  });
  return { api, jugador, pantallaFinal, completar,
    avanzar(ms) {
      tiempo += ms;
      for (const tarea of tareas) {
        if (!tarea.cancelada && !tarea.entregada && tarea.vence <= tiempo) {
          tarea.entregada = true; tarea.callback();
        }
      }
    } };
}

describe('RELEASE-004: muerte pendiente y pausa (CU-011, POL-FSM-001)', () => {
  it('R004-001: pausa conserva muerte legítima a 1499/1500 ms sin carga', () => {
    const h = prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    h.avanzar(1499);
    expect(h.api.estado()).toBe('pausa');
    expect(h.pantallaFinal).not.toHaveBeenCalled();
    h.avanzar(1);
    expect(h.api.estado()).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
    h.avanzar(1500);
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });

  // Supuesto explícito de regresión: empezarNivel continúa la misma partida;
  // no se ha invocado reinicio. La prioridad general carga/muerte sigue pendiente
  // de decisión humana; estos casos no autorizan muerte prioritaria sobre WIN.
  it('R004-002: misma partida pausada no pierde su derrota al iniciar carga pendiente', async () => {
    const h = prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    const cambio = h.api.empezarNivel(1);
    h.avanzar(1500);
    const estadoAlVencer = h.api.estado();
    h.completar(); await cambio;
    expect(estadoAlVencer).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });

  it('R004-003: completar carga en la misma partida no revive muerte pendiente pausada', async () => {
    const h = prepararNivel();
    h.api.matarJugador(); h.api.pausar();
    const cambio = h.api.empezarNivel(1);
    h.completar(); await cambio;
    expect(h.jugador.vivo).toBe(false);
    h.avanzar(1500);
    expect(h.api.estado()).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });
});

function disparoJugador(obstaculos, distancia = 8) {
  const recibirGolpe = vi.fn(() => false);
  const scene = new THREE.Scene();
  const jugador = { pos: new THREE.Vector3(), municion: 2, arma: { golpeEnemigo: 1.5 } };
  // Funciones de producción completas; solo decir y el scheduler visual son dobles.
  const disparar = runInNewContext(`
    const ALCANCE_PISTOLA = 18;
    ${funcion(combate, 'danarEnemigo')}
    ${funcion(combate, 'dispararJugador')}
    dispararJugador;
  `, { THREE, decir: vi.fn(), setTimeout: () => 1 });
  disparar({ jugador, scene, axel: {}, vista: { yaw: Math.PI },
    enemigos: [{ vivo: true, pos: new THREE.Vector3(0, 0, distancia), recibirGolpe }],
    mundo: { obstaculos }, sonido: { disparo: vi.fn(), impacto: vi.fn() }, obj: {} });
  for (const o of scene.children) { o.geometry?.dispose(); o.material?.dispose(); }
  return { recibirGolpe, jugador };
}

describe('RELEASE-004: trayectorias jugador (CU-010, RF-005)', () => {
  it('R004-004: trayectoria libre alcanza objetivo y consume una bala', () => {
    const h = disparoJugador([]);
    expect(h.recibirGolpe).toHaveBeenCalledTimes(1);
    expect(h.jugador.municion).toBe(1);
  });
  it('R004-005: obstáculo intermedio bloquea impacto', () => {
    expect(disparoJugador([{ x: 0, z: 4, r: 1 }]).recibirGolpe).not.toHaveBeenCalled();
  });
  it('R004-006: obstáculo fuera de trayectoria no bloquea impacto', () => {
    expect(disparoJugador([{ x: 3, z: 4, r: 1 }]).recibirGolpe).toHaveBeenCalledTimes(1);
  });
  it('R004-007: borde delantero de obstáculo bloquea aunque su centro quede detrás del blanco', () => {
    expect(disparoJugador([{ x: 0, z: 8.5, r: 1 }]).recibirGolpe).not.toHaveBeenCalled();
  });
});

function balaEnemiga(obstaculos) {
  const danar = vi.fn();
  const mesh = { position: new THREE.Vector3(0, 1.3, 0) };
  const enemigo = { mundo: { obstaculos, altura: () => 0 }, scene: { remove: vi.fn() },
    balas: [{ mesh, vel: new THREE.Vector3(0, 0, 26), vida: 1.6 }] };
  Enemigo.prototype.actualizarBalas.call(enemigo, 0.05,
    { vivo: true, pos: new THREE.Vector3(0, 0, 1.3), direccion: 0 }, danar);
  return { enemigo, danar };
}

describe('RELEASE-004: trayectorias enemigo real (CU-010, RF-005)', () => {
  it('R004-008: proyectil libre alcanza al jugador una sola vez y se retira', () => {
    const h = balaEnemiga([]);
    expect(h.danar).toHaveBeenCalledTimes(1);
    expect(h.enemigo.balas).toHaveLength(0);
  });
  it('R004-009: obstáculo intermedio bloquea proyectil enemigo', () => {
    const h = balaEnemiga([{ x: 0, z: 0.65, r: 0.2 }]);
    expect(h.danar).not.toHaveBeenCalled();
    expect(h.enemigo.balas).toHaveLength(0);
  });
  it('R004-010: obstáculo estrecho entre muestras también bloquea trayectoria', () => {
    expect(balaEnemiga([{ x: 0, z: 0.4875, r: 0.1 }]).danar).not.toHaveBeenCalled();
  });
});
