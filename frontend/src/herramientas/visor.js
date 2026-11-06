// Herramienta de desarrollo: muestra a Axel y a un mercenario con sus animaciones.
// Uso: /visor.html  (o /visor.html#caminar | #correr | #saltar | #golpear, &vista=cara|frente|lado)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Humano, VESTUARIO_AXEL } from '../personajes/personaje.js';
import { ARMAS, equiparArma } from '../personajes/armas.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3148);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);

scene.add(new THREE.HemisphereLight(0xffd9b0, 0x303a4a, 1.4));
const sol = new THREE.DirectionalLight(0xffb070, 3);
sol.position.set(-3, 5, 4);
sol.castShadow = true;
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.04;
scene.add(sol);
const relleno = new THREE.DirectionalLight(0x7080d0, 0.8);
relleno.position.set(4, 2, -3);
scene.add(relleno);

const suelo = new THREE.Mesh(new THREE.CircleGeometry(4, 48),
  new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 1 }));
suelo.rotation.x = -Math.PI / 2;
suelo.receiveShadow = true;
scene.add(suelo);

const loader = new GLTFLoader();
const a = await loader.loadAsync("/models/daniel.glb");
const axel = new Humano(a.scene);
axel.personalizarCabelloAxel();
axel.vestir(VESTUARIO_AXEL);
const enemigo = new Humano(clone(a.scene));
enemigo.personalizarMercenario();
enemigo.vestir({ vest: 0x5d6168, shirt: 0x1f2226, pants: 0x25282d, boots: 0x15120f });
const nombreArma = (location.hash.match(/arma=(\w+)/) || [])[1];
if (ARMAS[nombreArma]) equiparArma(enemigo, ARMAS[nombreArma]);
axel.grupo.position.x = -0.7;
enemigo.grupo.position.x = 0.7;
axel.mirarHacia(0, 1); enemigo.mirarHacia(0, 1);
scene.add(axel.grupo, enemigo.grupo);

const [modo, ...resto] = location.hash.slice(1).split("&");
let pose = modo || "reposo";
const fijo = resto.find((r) => r.startsWith("p="));
const vista = (resto.find((r) => r.startsWith("vista=")) || "vista=frente").split("=")[1];
addEventListener("keydown", (ev) => {
  pose = { 1: "reposo", 2: "caminar", 3: "correr", 4: "saltar", 5: "golpear", 6: "nadar", 7: "apuntar", 8: "morir" }[ev.key] || pose;
});

let yaw = vista === "lado" ? 1.2 : vista === "manos" ? 1.4 : vista === "perfil" || vista === "perfil2" ? 0.9 : 0.25, pitch = 0.08, dist = 3.2, ultimo = performance.now();
let t = 0, arrastrando = false;
addEventListener("pointerdown", () => (arrastrando = true));
addEventListener("pointerup", () => (arrastrando = false));
addEventListener("pointermove", (ev) => {
  if (!arrastrando) return;
  yaw -= ev.movementX * 0.006;
  pitch = Math.max(-0.2, Math.min(1, pitch + ev.movementY * 0.004));
});
addEventListener("wheel", (ev) => { dist = Math.max(1.2, Math.min(9, dist + ev.deltaY * 0.004)); });

function animar() {
  requestAnimationFrame(animar);
  const ahora = performance.now();
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;
  t += dt;

  const v = { reposo: 0, caminar: 3.4, correr: 6.4, saltar: 0, golpear: 0, nadar: 2.2 }[pose] ?? 0;
  const enSuelo = pose !== "saltar";
  const velocidadVertical = pose === "saltar" ? Math.cos(t * 2.4) * 7.2 : 0;
  for (const h of [axel, enemigo]) {
    if (pose === "golpear" && fijo) { h.congelarGolpe = +fijo.split("=")[1]; if (h.golpeT < 0) h.golpear(); }
    else if (pose === "golpear" && h.golpeT < 0) h.golpear();
    if (pose === "morir" && !h.muerto) h.morir();   // cada vez cae distinto (atras, adelante o de lado)
    h.apuntando = pose === "apuntar" ? 1 : 0;
    h.actualizar(dt, v, enSuelo, t, velocidadVertical, pose === "nadar");
  }

  const foco = vista === "cara" || vista === "perfil" ? new THREE.Vector3(-0.7, 1.65, 0)
    : vista === "cara2" || vista === "perfil2" ? new THREE.Vector3(0.7, 1.65, 0)
    : vista === "manos" ? new THREE.Vector3(-0.44, 0.88, 0) : new THREE.Vector3(0, 0.95, 0);
  const d = ["cara", "perfil", "cara2", "perfil2"].includes(vista) ? 1.1 : vista === "manos" ? 0.55 : dist;
  camera.position.set(
    foco.x + Math.sin(yaw) * Math.cos(pitch) * d,
    foco.y + Math.sin(pitch) * d,
    foco.z + Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(foco);
  renderer.render(scene, camera);
}
animar();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
