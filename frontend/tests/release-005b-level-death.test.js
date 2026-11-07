import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';

// POL-LEVEL-001: cambiar nivel no reinicia partida, cancela muerte ni revive.
// Modo normal = producción actual. R005B_CANDIDATO=1 aplica el parche documental
// exclusivamente a una cadena en memoria; jamás escribe main.js.
const actual = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
function aplicarEnMemoria(source, patch) {
  const lineas = source.split('\n');
  const salida = [];
  let cursor = 0;
  const filas = patch.replaceAll('\r\n', '\n').split('\n');
  const archivos = filas.filter((l) => l.startsWith('+++ '));
  if (archivos.length !== 1 || !archivos[0].endsWith('frontend/src/main.js')) throw new Error('El candidato debe modificar únicamente main.js');
  for (let i = 0; i < filas.length; i++) {
    const cabecera = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(filas[i]);
    if (!cabecera) continue;
    const inicio = Number(cabecera[1]) - 1;
    if (inicio < cursor) throw new Error('Hunks solapados');
    salida.push(...lineas.slice(cursor, inicio)); cursor = inicio;
    let antiguos = 0, nuevos = 0;
    while (i + 1 < filas.length && !filas[i + 1].startsWith('@@ ') && !filas[i + 1].startsWith('diff --git ')) {
      const fila = filas[++i];
      if (fila.startsWith('\\') || fila === '') continue;
      if (fila[0] === ' ' || fila[0] === '-') {
        if (lineas[cursor] !== fila.slice(1)) throw new Error(`Contexto de parche diferente en línea ${cursor + 1}`);
        cursor++; antiguos++;
      }
      if (fila[0] === ' ' || fila[0] === '+') { salida.push(fila.slice(1)); nuevos++; }
    }
    if (antiguos !== Number(cabecera[2] ?? 1) || nuevos !== Number(cabecera[4] ?? 1)) throw new Error('Conteos de hunk inválidos');
  }
  salida.push(...lineas.slice(cursor));
  return salida.join('\n');
}
const candidato = process.env.R005B_CANDIDATO === '1';
const source = candidato ? aplicarEnMemoria(actual,
  readFileSync(new URL('../../docs/architecture/release-005b-main.patch', import.meta.url), 'utf8')) : actual;
const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };

function preparar({ vida = 85 } = {}) {
  let ahora = 0;
  const tareas = [], cargas = [], liberados = [], callbacks = [];
  const scene = new THREE.Scene();
  function mundoDe(tema, objeto = new THREE.Group()) {
    return { objetos: [objeto], spawn: { x: tema.n * 10, z: 0 }, altura: () => 0,
      tema, obstaculos: [], portal: { activo: true, x: 0, z: 0, radio: 2 },
      actualizar: vi.fn(), seguirCamara: vi.fn() };
  }
  const inicial = mundoDe({ n: 0 }); scene.add(...inicial.objetos);
  const jugador = { vivo: true, vida, pos: new THREE.Vector3(), vel: new THREE.Vector3(), invulnerable: 0 };
  const cuenta = { guardarNivel: vi.fn(), registrarVictoria: vi.fn() };
  const pantallaFinal = vi.fn(), decir = vi.fn();
  const clases = { toggle: vi.fn(), remove: vi.fn() };
  const hud = { titulo: {}, texto: {}, boton: {}, pantalla: { classList: clases }, dano: { style: {} },
    filaFrio: { classList: clases }, filaCalor: { classList: clases } };
  const axelInicial = { morir: vi.fn(), destello: vi.fn(), herir: vi.fn(), grupo: new THREE.Group() };
  const sonido = { derrota: vi.fn(), victoria: vi.fn(), dolor: vi.fn() };
  const contexto = {
    THREE, scene, jugador, inicial, axelInicial, cuenta, pantallaFinal, decir, hud, sonido,
    renderer: { compileAsync: vi.fn(async () => {}) }, camera: new THREE.PerspectiveCamera(),
    performance: { now: () => ahora }, dispositivo: { tactil: false },
    document: { exitPointerLock: vi.fn(), getElementById: () => ({}) },
    setTimeout(callback, demora) {
      const tarea = { callback, vence: ahora + demora, cancelada: false, entregada: false };
      tareas.push(tarea); return tarea;
    },
    clearTimeout: (t) => { t.cancelada = true; },
    crearMundo(escena, loader, tema) {
      let resolver;
      const promesa = new Promise((r) => { resolver = r; });
      const objeto = new THREE.Group(); escena.add(objeto);
      const mundo = mundoDe(tema, objeto);
      cargas.push({ mundo, resuelta: false, resolver: () => { resolver(mundo); } });
      return promesa;
    },
    liberar(escena, objetos) { for (const o of objetos) { escena.remove(o); liberados.push(o); } },
    NIVELES: [0, 1, 2].map((n) => ({ nombre: `Nivel ${n}`, enemigos: 0 })),
    TEMAS: [0, 1, 2].map((n) => ({ n })), gltfLoader: {},
    obj: { idolos: 1 }, suministros: { reiniciar: vi.fn() }, enemigos: [], CASAS: [],
    crearDaniel: () => ({ grupo: new THREE.Group() }), clonarModelo: () => ({}),
    danielPos: new THREE.Vector3(), cerrarDialogo: vi.fn(),
    frio: { reiniciar: vi.fn(), activo: false }, fundido: { style: { opacity: 0 } }, IDOLOS_POR_NIVEL: 2,
  };
  // Se ejecutan declaraciones originales completas, incluidos helpers del parche.
  // Los colaboradores doblados no deciden vigencia, estado, vida ni publicación.
  const funciones = [...source.matchAll(/^(?:async )?function \w+\([^]*?^}/gm)].map((m) => m[0]).join('\n');
  const variables = source.split('\n').filter((l) => /^let /.test(l)).join('\n');
  const helpers = source.split('\n').filter((l) => /^const (esTerminal|nivelVigente)\b/.test(l)).join('\n');
  const api = runInNewContext(`${variables}\n${helpers}\n${funciones}
    estado='jugando'; mundo=inicial; axel=axelInicial; tiempoFinal=10;
    ({ empezarNivel, revisarPortal, matarJugador, pausar, danar,
       leer:()=>({estado,nivel,cambiandoNivel,mundo}),
       moverAlPortal:()=>jugador.pos.set(0,0,0) });`, contexto);
  return { api, jugador, cuenta, pantallaFinal, sonido, inicial, scene, cargas, liberados, decir,
    tareas, fundido: contexto.fundido,
    async resolverCargas() {
      for (let ronda = 0; ronda < 8; ronda++) {
        await tick();
        for (const carga of cargas) if (!carga.resuelta) { carga.resuelta = true; carga.resolver(); }
      }
      await tick();
    },
    async avanzar(ms) {
      ahora += ms;
      for (const tarea of tareas) if (!tarea.cancelada && !tarea.entregada && tarea.vence <= ahora) {
        tarea.entregada = true;
        const resultado = tarea.callback();
        if (resultado?.then) callbacks.push(resultado);
      }
      await tick();
    },
    async acabarCallbacks() { await Promise.all(callbacks); },
  };
}

describe(`RELEASE-005B POL-LEVEL-001 [${candidato ? 'CANDIDATO SOLO EN MEMORIA, NO PRODUCCIÓN' : 'CÓDIGO ACTUAL'}]`, () => {
  it('L005B-01: muerte antes de solicitar nivel conserva mundo y progreso', async () => {
    const h = preparar(); h.api.matarJugador();
    const p = h.api.empezarNivel(1); await h.resolverCargas(); await p;
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
    expect(h.jugador.vivo).toBe(false);
  });
  it('L005B-02: muerte durante fade-out invalida el callback de transición', async () => {
    const h = preparar(); h.api.revisarPortal(); h.api.matarJugador();
    await h.avanzar(700); await h.resolverCargas(); await h.acabarCallbacks(); await h.avanzar(800);
    expect(h.api.leer().estado).toBe('derrota');
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-03: muerte durante carga async no publica el candidato ni revive', async () => {
    const h = preparar(); const p = h.api.empezarNivel(1); await tick();
    h.api.matarJugador(); await h.resolverCargas(); await p;
    expect(h.jugador.vivo).toBe(false);
    expect(h.api.leer().mundo).toBe(h.inicial);
    expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-04: pausa mantiene deadline 1499/1500 ms de derrota pendiente', async () => {
    const h = preparar(); h.api.matarJugador(); h.api.pausar();
    await h.avanzar(1499); expect(h.api.leer().estado).toBe('pausa');
    await h.avanzar(1); expect(h.api.leer().estado).toBe('derrota');
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1);
  });
  it('L005B-05: carga finalizada después de derrota no altera terminal, vida ni progreso', async () => {
    const h = preparar(); const p = h.api.empezarNivel(1); await tick();
    h.api.matarJugador(); await h.avanzar(1500);
    await h.resolverCargas(); await p;
    expect(h.api.leer().estado).toBe('derrota'); expect(h.jugador.vivo).toBe(false);
    expect(h.api.leer().mundo).toBe(h.inicial); expect(h.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-06: reinicio por reload usa nuevo realm; callback viejo no modifica partida nueva', async () => {
    // main actual reinicia por location.reload: se modelan dos realms, no una API inventada.
    // Entregar artificialmente el callback del realm antiguo prueba aislamiento;
    // no demuestra cancelación de tareas ni navegación real del navegador.
    const anterior = preparar(); anterior.api.matarJugador();
    const nueva = preparar(); await anterior.avanzar(1500);
    expect(nueva.jugador.vivo).toBe(true); expect(nueva.api.leer().estado).toBe('jugando');
    expect(nueva.pantallaFinal).not.toHaveBeenCalled(); expect(nueva.cuenta.guardarNivel).not.toHaveBeenCalled();
  });
  it('L005B-07: callback de derrota duplicado no repite efectos terminales', async () => {
    const h = preparar(); h.api.matarJugador();
    const tarea = h.tareas.find((t) => t.vence === 1500);
    await h.avanzar(1500); tarea.callback(); tarea.callback();
    expect(h.pantallaFinal).toHaveBeenCalledTimes(1); expect(h.sonido.derrota).toHaveBeenCalledTimes(1);
  });
  it('L005B-08: cambio exitoso con jugador vivo publica nivel una sola vez', async () => {
    const h = preparar(); const p = h.api.empezarNivel(1);
    await h.resolverCargas(); await p;
    expect(h.api.leer().nivel).toBe(1); expect(h.api.leer().mundo).not.toBe(h.inicial);
    expect(h.api.leer().cambiandoNivel).toBe(false); expect(h.jugador.vivo).toBe(true);
    expect(h.cuenta.guardarNivel).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('L005B-09: carga pendiente conserva vida, pausa, mundo y progreso hasta publicar', async () => {
    const h = preparar({ vida: 85 }); h.api.pausar();
    const p = h.api.empezarNivel(1); await tick();
    const antes = { ...h.api.leer(), guardados: h.cuenta.guardarNivel.mock.calls.length, vida: h.jugador.vida };
    await h.resolverCargas(); await p;
    expect(antes.estado).toBe('pausa'); expect(antes.vida).toBe(85);
    expect(antes.mundo).toBe(h.inicial); expect(antes.guardados).toBe(0);
    expect(h.api.leer().estado).toBe('pausa'); expect(h.jugador.vida).toBe(85);
  });
  it('L005B-10: solicitud obsoleta no publica recursos, progreso ni mensaje de nivel', async () => {
    const h = preparar(); const p1 = h.api.empezarNivel(1); await tick();
    const p2 = h.api.empezarNivel(2); await h.resolverCargas(); await Promise.all([p1, p2]);
    expect(h.api.leer().nivel).toBe(2); expect(h.api.leer().mundo.tema.n).toBe(2);
    expect(h.cuenta.guardarNivel.mock.calls).toEqual([[2]]);
    expect(h.decir).not.toHaveBeenCalled();
    expect(h.scene.children).not.toContain(h.cargas[0].mundo.objetos[0]);
  });
});
