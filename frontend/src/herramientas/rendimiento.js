// Herramienta de desarrollo: mide el costo de cada nivel (llamadas de dibujo, triangulos, luces,
// sombras y tiempo por cuadro) con Max y los mercenarios en escena. Uso: /rendimiento.html
// #2 mide solo el nivel 2; ?f=30 cambia los cuadros medidos. El resultado sale en pantalla y en la consola.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { crearMundo } from '../escenario/mundo.js';
import { TEMAS } from '../escenario/temas.js';
import { Humano } from '../personajes/personaje.js';
import { Enemigo } from '../personajes/enemigo.js';
import { NIVELES } from '../juego/datos.js';
import { CASAS } from '../juego/datos.js';

const FRAMES = +(new URLSearchParams(location.search).get('f') || 90);
const SOLO = location.hash ? +location.hash.slice(1) : -1;   // #1, #2, #3: mide un solo nivel
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1280, 720);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();
const loader = new GLTFLoader();
const base = await loader.loadAsync("/models/daniel.glb");
const salida = document.getElementById("salida");
const resultados = [];

for (let n = 0; n < TEMAS.length; n++) {
  if (SOLO > 0 && n !== SOLO - 1) continue;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 1200);
  const t0 = performance.now();
  const mundo = await crearMundo(scene, loader, TEMAS[n]);
  const tCarga = performance.now() - t0;
  const max = new Humano(clonarModelo(base.scene));
  max.personalizarCabelloAxel();
  scene.add(max.grupo);
  const pos = new THREE.Vector3(mundo.spawn.x, mundo.altura(mundo.spawn.x, mundo.spawn.z), mundo.spawn.z);
  max.grupo.position.copy(pos);
  const enemigos = CASAS.slice(0, NIVELES[n].enemigos).map(([x, z]) => new Enemigo(clonarModelo(base.scene), x, z, mundo, scene));

  let luces = 0, casters = 0, mallas = 0, instancias = 0, puntos = 0;
  scene.traverse((o) => {
    if (o.isLight) luces++;
    if (o.isMesh || o.isSkinnedMesh) { mallas++; if (o.castShadow) casters++; }
    if (o.isInstancedMesh) instancias += o.count;
    if (o.isPoints) puntos++;
  });

  // las mallas mas pesadas (triangulos de su geometria x instancias)
  const pesadas = [];
  scene.traverse((o) => {
    if (!o.geometry) return;
    if (o.visible === false) return;           // lo oculto no se dibuja
    const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.count || 1);
    pesadas.push({ tri: Math.round(tri), sombra: !!o.castShadow, tipo: o.type, nombre: o.name || o.parent?.name || "" });
  });
  pesadas.sort((a, b) => b.tri - a.tri);
  const triTotal = pesadas.reduce((s, m) => s + m.tri, 0);

  const tiempos = { update: 0, render: 0, total: 0 };
  let pico = 0;
  let llamadas = 0, triangulos = 0;
  for (let f = 0; f < FRAMES; f++) {
    const t = f / 60;
    const a = performance.now();
    mundo.actualizar(t, 1 / 60, pos);
    max.actualizar(1 / 60, 0, true, t);
    const jugador = { pos, vivo: true };
    for (const e of enemigos) e.actualizar(1 / 60, t, jugador, () => {}, null);
    camera.position.set(pos.x, pos.y + 4, pos.z + 8);
    camera.lookAt(pos.x, pos.y + 1, pos.z);
    mundo.seguirCamara(camera.position);
    const b = performance.now();
    renderer.render(scene, camera);
    const c = performance.now();
    gl.finish();
    const d = performance.now();
    if (f >= 10) {          // los primeros cuadros compilan shaders: se miden aparte
      tiempos.update += b - a; tiempos.render += c - b; tiempos.total += d - a;
      pico = Math.max(pico, d - a);
    }
    llamadas = renderer.info.render.calls;
    triangulos = renderer.info.render.triangles;
  }
  const k = FRAMES - 10;
  resultados.push({
    nivel: NIVELES[n].nombre,
    cargaMs: Math.round(tCarga),
    updateMs: +(tiempos.update / k).toFixed(2),
    renderCpuMs: +(tiempos.render / k).toFixed(2),
    totalMsSoftware: +(tiempos.total / k).toFixed(1),
    picoMs: +pico.toFixed(1),
    llamadas, triangulos,
    geometrias: renderer.info.memory.geometries, texturas: renderer.info.memory.textures,
    programas: renderer.info.programs.length,
    luces, mallas, casters, instancias, sistemasParticulas: puntos,
    triEscena: triTotal,
    top: Object.entries(pesadas.reduce((a, m) => { const k = `${m.nombre || m.tipo}${m.sombra ? " (sombra)" : ""}`; a[k] = (a[k] || 0) + m.tri; return a; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 14)
  });
  for (const e of enemigos) e.limpiar();
}
salida.textContent = JSON.stringify(resultados, null, 1);
console.log("RESULTADO " + JSON.stringify(resultados));
document.title = "listo";
