// Herramienta de desarrollo: recorre los tres niveles (isla, montana, desierto) con camara libre.
// Uso: /niveles.html  (o /niveles.html#2 para abrir el nivel 2)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { crearMundo } from '../escenario/mundo.js';
import { TEMAS } from '../escenario/temas.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
const loader = new GLTFLoader();

const $ = (id) => document.getElementById(id);
let mundo = null, nivel = 0, cargando = false;
let portalVisible = true;
const foco = new THREE.Vector3();
let yaw = 0.6, pitch = 0.45, dist = 80;

// ---- botones
const contenedor = $("niveles");
TEMAS.forEach((t, i) => {
  const b = document.createElement("button");
  b.textContent = `${i + 1}. ${t.nombre}`;
  b.onclick = () => cargar(i);
  contenedor.appendChild(b);
});
const VISTAS = {
  "Vista general": () => ({ f: [0, 0, 0], d: 95, p: 0.55 }),
  "Inicio": () => ({ f: [mundo.spawn.x, 0, mundo.spawn.z], d: 14, p: 0.3 }),
  "Altar": () => ({ f: [0, 0, 0], d: 16, p: 0.3 }),
  "Salida": () => ({ f: [mundo.salida.x, 0, mundo.salida.z], d: 18, p: 0.3 }),
  "Ídolos": () => ({ f: [mundo.idolos[0].x, 0, mundo.idolos[0].z], d: 10, p: 0.3 })
};
for (const [nombre, f] of Object.entries(VISTAS)) {
  const b = document.createElement("button");
  b.textContent = nombre;
  b.onclick = () => { if (mundo) irA(f()); };
  $("vistas").appendChild(b);
}
function irA({ f, d, p }) {
  foco.set(f[0], mundo.altura(f[0], f[2]), f[2]);
  dist = d; pitch = p;
}

async function cargar(n) {
  if (cargando) return;
  cargando = true;
  $("estado").textContent = `Cargando ${TEMAS[n].nombre}…`;
  if (mundo) for (const o of mundo.objetos) scene.remove(o);
  const antes = new Set(scene.children);
  const nuevo = await crearMundo(scene, loader, TEMAS[n]);
  nuevo.objetos = scene.children.filter((o) => !antes.has(o));
  mundo = nuevo;
  nivel = n;
  portalVisible = true;
  mostrarSalida();
  irA(VISTAS["Vista general"]());
  [...contenedor.children].forEach((b, i) => b.classList.toggle("activo", i === n));
  $("estado").textContent = `${TEMAS[n].nombre} · ${TEMAS[n].tipo} · salida: ${TEMAS[n].vehiculo}`;
  history.replaceState(null, "", `#${n + 1}`);
  cargando = false;
}

function mostrarSalida() {
  if (portalVisible) mundo.mostrarPortal(mundo.salida.x, mundo.salida.z, mundo.tema.vehiculo);
  else mundo.ocultarPortal();
}

// ---- camara y teclado
const teclas = {};
let arrastrando = false;
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  teclas[k] = true;
  if (k >= "1" && k <= String(TEMAS.length)) cargar(+k - 1);
  if (k === "p" && mundo) { portalVisible = !portalVisible; mostrarSalida(); }
});
addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });
addEventListener("pointerdown", (e) => { if (e.target === renderer.domElement) arrastrando = true; });
addEventListener("pointerup", () => (arrastrando = false));
addEventListener("pointermove", (e) => {
  if (!arrastrando) return;
  yaw -= e.movementX * 0.006;
  pitch = THREE.MathUtils.clamp(pitch + e.movementY * 0.004, 0.05, 1.45);
});
addEventListener("wheel", (e) => { dist = THREE.MathUtils.clamp(dist * (1 + e.deltaY * 0.0012), 4, 220); });
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let ultimo = performance.now(), t = 0;
function animar() {
  requestAnimationFrame(animar);
  const ahora = performance.now();
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;
  t += dt;
  if (!mundo) return;

  const v = dist * 0.6 * dt;
  const ax = (teclas["d"] ? 1 : 0) - (teclas["a"] ? 1 : 0), az = (teclas["s"] ? 1 : 0) - (teclas["w"] ? 1 : 0);
  foco.x += (Math.cos(yaw) * ax + Math.sin(yaw) * az) * v;
  foco.z += (-Math.sin(yaw) * ax + Math.cos(yaw) * az) * v;
  foco.y = mundo.altura(foco.x, foco.z);

  mundo.actualizar(t, dt, foco);
  camera.position.set(
    foco.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    foco.y + Math.sin(pitch) * dist + 1,
    foco.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.position.y = Math.max(camera.position.y, mundo.altura(camera.position.x, camera.position.z) + 1);
  camera.lookAt(foco);
  mundo.seguirCamara(camera.position);
  renderer.render(scene, camera);
}
animar();
cargar(Math.min(Math.max((+location.hash.slice(1) || 1) - 1, 0), TEMAS.length - 1));
