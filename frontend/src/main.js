import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { crearMundo, liberar } from './escenario/mundo.js';
import { TEMAS } from './escenario/temas.js';
import { clone as clonarModelo } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Humano, DURACION_GOLPE, INSTANTE_IMPACTO, VESTUARIO_AXEL } from './personajes/personaje.js';
import { Enemigo, separarEnemigos } from './personajes/enemigo.js';
import { crearDaniel } from './personajes/daniel.js';
import { Sonido } from './audio/audio.js';
import { montarEscenaFinal } from './escenario/casa.js';
import { crearVista } from './juego/camara.js';
import { crearFrio } from './juego/frio.js';
import { resolverGolpe, dispararJugador } from './juego/combate.js';
import { crearSuministros } from './juego/suministros.js';
import { crearCinematicaAvion } from './escenario/cinematica.js';
import { crearCinematicaPlaya } from './escenario/cinematicaPlaya.js';
import { gestionarPersonajes, crearResolucionDinamica } from './juego/detalle.js';
import { hud, decir, fundido, cajaDialogo, avisoHablar, mostrarLinea, cerrarDialogo, pintarObjetivos, pantallaFinal } from './interfaz/hud.js';
import * as cuenta from './cuenta/cuenta.js';
import { dispositivo, medidaVisible, pantallaCompleta } from './interfaz/dispositivo.js';
import { crearControlesTactiles } from './interfaz/tactil.js';
import { IDOLOS_POR_NIVEL, METROS_NADO, NIVELES, GUIONES, CINEMATICAS, CASAS, objetivos } from './juego/datos.js';

// ============================================================
// 1. RENDERIZADOR, ESCENA Y CAMARA
// ============================================================
// Computador: calidad alta. Movil/tableta: media. Raspberry Pi y equipos modestos: baja (ver dispositivo.js)
const renderer = new THREE.WebGLRenderer({ antialias: dispositivo.antialias, powerPreference: "high-performance" });
const medida = medidaVisible();
renderer.setSize(medida.ancho, medida.alto);
const resolucion = crearResolucionDinamica(renderer, { maximo: dispositivo.pixelRatioMax, minimo: dispositivo.pixelRatioMin });   // baja o sube la resolucion segun lo que aguante la tarjeta grafica
renderer.shadowMap.enabled = dispositivo.sombras;
renderer.shadowMap.type = dispositivo.calidad === "baja" ? THREE.BasicShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.domElement.setAttribute("aria-label", "Escena 3D del juego"); (document.querySelector("main") ?? document.body).prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60, medida.ancho / medida.alto, 0.1, 1200);
ajustarCamara();

// ============================================================
// 3. ESTADO DEL JUEGO
// ============================================================
let nivel = 0;
let cambiandoNivel = false;
let solicitudNivel = 0;
let metaLista = false;                // objetivos completos: el bote ya esta en el mar
let avisoMar = 0;
let avisoFrio = 0;
let cine = null;                      // cinematica en curso (estado "cinematica")
const cinematicasVistas = new Set();   // niveles cuyo choque de avion ya se vio (Max se pone el sombrero despues)
const cinesHechas = new Set();         // "nivel:linea" de cada cinematica ya mostrada
const obj = { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 };
const danielPos = new THREE.Vector3();
let misionesAceptadas = false;
let dialogo = null;                   // { lineas, i } mientras Daniel habla
let puedeTeletransportar = true;      // enfriamiento del portal (3 s, como en la clase)
const sonido = new Sonido();
const gltfLoader = new GLTFLoader();

let estado = "cargando";     // cargando | inicio | jugando | pausa | victoria | derrota
const esTerminal = () => estado === "victoria" || estado === "derrota";
const nivelVigente = (id) => id === solicitudNivel && jugador.vivo && !esTerminal();
let mundo, axel, daniel;
const enemigos = [];
let modeloEnemigo;

const jugador = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  vy: 0,
  enSuelo: true,
  vida: 100,
  vivo: true,
  idolos: 0,
  invulnerable: 0,
  golpeCooldown: 0,
  golpePendiente: -1,
  heridasT: 0,
  nadando: false,
  arma: null,           // arma de un kit (null = puños)
  municion: 0
};

const suministros = crearSuministros({ scene, sonido, jugador });   // botiquines y kits de arma al azar
const frio = crearFrio();               // barras de frio y calor (solo en la montaña)
const vista = crearVista(scene, camera);   // camara en tercera persona (camara.js)
let tiempo = 0;
let pasoAnterior = 0;
let proximaBrazada = 0;
let proximoSondeoAgua = 0;           // el sonido del agua se recalcula 5 veces por segundo
let tiempoFinal = 0;

// ============================================================
// 4. CONTROLES
// ============================================================
const teclas = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  teclas[k] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (estado === "jugando" && (k === "f" || k === "j") && !dialogo) atacar();
  if (estado === "jugando" && k === "e" && jugador.vivo && daniel &&
      (dialogo || Math.hypot(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z) < 3.6)) hablarConDaniel();
  if (k === "r" && (estado === "victoria" || estado === "derrota")) location.reload();
});
window.addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });

window.addEventListener("mousedown", (e) => {
  if (dispositivo.tactil || estado !== "jugando" || e.button !== 0) return;   // en el movil se usan los botones en pantalla
  if (!document.pointerLockElement) bloquearRaton();   // recupera el ratón (p. ej. tras la cinemática)
  else if (!dialogo) atacar();
});

window.addEventListener("mousemove", (e) => {
  if (estado !== "jugando" || !document.pointerLockElement) return;
  vista.yaw -= e.movementX * 0.0025;
  vista.pitch = THREE.MathUtils.clamp(vista.pitch + e.movementY * 0.002, -0.15, 1.15);
});

function bloquearRaton() {
  if (dispositivo.tactil) return;      // sin raton no hay bloqueo del puntero
  const r = renderer.domElement.requestPointerLock?.();
  if (r && r.catch) r.catch(() => {});
}

document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement && (estado === "jugando" || estado === "cinematica")) pausar();
});

function pausar() {
  estado = "pausa";
  hud.titulo.textContent = "PAUSA";
  hud.texto.textContent = dispositivo.tactil ? "Toca para continuar." : "Haz clic para continuar.";
  hud.boton.textContent = "Continuar";
  hud.pantalla.classList.remove("oculta");
}

// ---- controles tactiles (solo moviles y tabletas)
function hablarSiEstaCerca() {
  if (estado !== "jugando" || !jugador.vivo || !daniel) return;
  if (dialogo || Math.hypot(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z) < 3.6) hablarConDaniel();
}
const tactil = dispositivo.tactil ? crearControlesTactiles(vista, {
  atacar: () => { if (estado === "jugando" && !dialogo) atacar(); },
  hablar: hablarSiEstaCerca,
  pausar: () => { if (estado === "jugando") pausar(); }
}) : null;
cajaDialogo.addEventListener("pointerdown", () => { if (tactil) hablarSiEstaCerca(); });   // tocar el cuadro avanza el dialogo

// Al cambiar de pestaña o apagar la pantalla, el juego se pausa solo
document.addEventListener("visibilitychange", () => { if (document.hidden && estado === "jugando") pausar(); });

hud.boton.addEventListener("click", () => {
  if (estado === "inicio" || estado === "pausa") {
    if (dispositivo.tactil) pantallaCompleta();
    sonido.iniciar();
    estado = cine ? "cinematica" : "jugando";   // si se pausó en plena cinemática, sigue donde iba
    hud.pantalla.classList.add("oculta");
    hud.ui.classList.remove("oculta");
    bloquearRaton();
    if (!window.__bienvenida) {
      window.__bienvenida = true;
      decir("Habla con Daniel (E) para recibir tus misiones.", 5);
    }
  } else if (estado === "victoria" || estado === "derrota") {
    location.reload();
  }
});

// Ajusta camara y lienzo al tamaño visible. En el movil cambia al girar el aparato o al ocultarse la
// barra del navegador; en pantallas muy estrechas se ensancha el campo de vision para no ver "por un tubo".
function ajustarCamara() {
  const { ancho, alto } = medidaVisible();
  camera.aspect = ancho / alto;
  camera.fov = camera.aspect < 1 ? Math.min(85, 60 / Math.max(camera.aspect, 0.6)) : 60;
  camera.updateProjectionMatrix();
  renderer.setSize(ancho, alto);
}
window.addEventListener("resize", ajustarCamara);
window.addEventListener("orientationchange", () => setTimeout(ajustarCamara, 200));
window.visualViewport?.addEventListener("resize", ajustarCamara);

// ============================================================
// 5. CARGA DE MODELOS (hechos en Blender)
// ============================================================
const esModoDev = import.meta.env.DEV;
async function iniciar() {
  // La misma base de Mixamo conserva las proporciones; cada mercenario recibe rasgos propios.
  const gAxel = await gltfLoader.loadAsync("/models/daniel.glb?v=" + Date.now());
  modeloEnemigo = clonarModelo(gAxel.scene);
  axel = new Humano(gAxel.scene);
  axel.personalizarCabelloAxel();
  // La camisa aporta las mangas de la chaqueta de cuero.
  axel.vestir(VESTUARIO_AXEL);
  scene.add(axel.grupo);

  axel.direccion = Math.PI;
  axel.grupo.rotation.y = Math.PI;

  await cuenta.sesion();                       // inicio de sesion (o invitado) antes de elegir el nivel
  const inicial = esModoDev && /nivel=(\d)/.exec(location.hash);   // #demo&nivel=1 salta a otro bioma (solo en desarrollo)
  await empezarNivel(inicial ? Math.min(+inicial[1], NIVELES.length - 1) : cuenta.nivelGuardado());

  // Modo de prueba: index.html#demo  o  index.html#demo=x,z (empieza sin pulsar "Jugar")
  if (esModoDev && location.hash.startsWith("#demo")) {
    const [dx, dz, dyaw] = (location.hash.split("=")[1] || "").split(",").map(Number);
    if (!Number.isNaN(dx) && !Number.isNaN(dz)) jugador.pos.set(dx, mundo.altura(dx, dz), dz);
    if (!Number.isNaN(dyaw)) vista.yaw = dyaw;   // 3.14 = camara de frente a Axel
    estado = "jugando";
    hud.pantalla.classList.add("oculta");
    hud.ui.classList.remove("oculta");
    return;
  }

  estado = "inicio";
  hud.boton.disabled = false;
  hud.boton.textContent = "Jugar";
  hud.texto.innerHTML = "Eres <b>Max Montenegro</b>, un explorador atrapado en una isla con ruinas antiguas. " +
    "Atraviesa <b>una isla, una montaña y un desierto</b> en busca del ídolo perdido: reúne los <b>ídolos dorados</b>, " +
    "cumple los objetivos de cada nivel, sobrevive a los mercenarios y llega a la salida para volver a casa.";
}

// ============================================================
// 5b. NIVELES Y PORTAL
// ============================================================
// Cada nivel descarta los objetos del mundo anterior y construye una isla nueva con su tema.
async function cargarMundo(n) {
  const antes = new Set(scene.children);
  const nuevo = await crearMundo(scene, gltfLoader, TEMAS[n]);
  nuevo.objetos = scene.children.filter((o) => !antes.has(o));
  return nuevo;
}

async function empezarNivel(n) {
  if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (estado === "victoria" || estado === "derrota"))) return;
  const req = typeof solicitudNivel === "number" ? ++solicitudNivel : 1;
  const esVigente = () => typeof nivelVigente === "function"
    ? nivelVigente(req)
    : (jugador.vivo && estado !== "victoria" && estado !== "derrota");
  cambiandoNivel = true;
  const def = NIVELES[n];
  const nuevo = await cargarMundo(n);
  await precalentar();
  if (!esVigente()) {
    if (nuevo?.objetos && typeof liberar === "function") liberar(scene, nuevo.objetos);
    if (typeof solicitudNivel !== "number" || req === solicitudNivel) cambiandoNivel = false;
    return;
  }
  if (nuevo && mundo && mundo !== nuevo && typeof liberar === "function") liberar(scene, mundo.objetos);
  if (nuevo) mundo = nuevo;
  nivel = n;
  cuenta.guardarNivel(n);
  Object.assign(obj, { idolos: 0, derrotados: 0, fogata: false, altar: false, nado: 0 });
  metaLista = false;
  jugador.vida = Math.max(jugador.vida, 60);
  suministros.reiniciar();

  // mercenarios nuevos para este nivel
  for (const e of enemigos) { scene.remove(e.humano.grupo); e.limpiar(); }
  enemigos.length = 0;
  for (const [x, z] of CASAS.slice(0, def.enemigos)) {
    const en = new Enemigo(clonarModelo(modeloEnemigo), x, z, mundo, scene);
    // mercenarios: chaleco gris y ropa oscura para distinguirlos de Axel
    en.humano.vestir({ vest: 0x5d6168, shirt: 0x1f2226, pants: 0x25282d, boots: 0x15120f });
    enemigos.push(en);
  }
  // Daniel espera junto al punto de inicio
  if (daniel) scene.remove(daniel.grupo);
  daniel = crearDaniel(clonarModelo(modeloEnemigo));
  danielPos.set(mundo.spawn.x - 3, 0, mundo.spawn.z - 2.5);
  danielPos.y = mundo.altura(danielPos.x, danielPos.z);
  daniel.grupo.position.copy(danielPos);
  scene.add(daniel.grupo);
  mundo.obstaculos.push({ x: danielPos.x, z: danielPos.z, r: 0.5 });
  misionesAceptadas = false;
  dialogo = null;
  cerrarDialogo();
  jugador.pos.set(mundo.spawn.x, mundo.altura(mundo.spawn.x, mundo.spawn.z), mundo.spawn.z);
  jugador.vel.set(0, 0, 0);
  jugador.vy = 0;
  jugador.nadando = false;
  frio.reiniciar(!!mundo.tema.frio);
  hud.filaFrio.classList.toggle("oculta", !frio.activo);
  hud.filaCalor.classList.toggle("oculta", !frio.activo);
  document.getElementById("nivel").textContent = `Nivel ${n + 1}/${NIVELES.length}: ${def.nombre}`;
  cambiandoNivel = false;
}

// Compila de antemano todos los shaders del nivel, incluso los de lo que aun esta oculto (portal,
// haz del altar...). Sin esto cada uno se compila la primera vez que aparece y el juego se congela
// un instante justo en ese momento. Se hace durante la carga, en paralelo si el navegador puede.
async function precalentar() {
  const ocultos = [];
  scene.traverse((o) => { if (o.visible === false && (o.isMesh || o.isPoints || o.isSprite)) ocultos.push(o); });
  for (const o of ocultos) o.visible = true;
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn("precalentar:", e); }
  for (const o of ocultos) o.visible = false;
}

// Max inconsciente para las cinematicas del naufragio: tendido, flojo y con los ojos cerrados
function crearMaxInconsciente() {
  const max = new Humano(clonarModelo(modeloEnemigo));
  max.personalizarCabelloAxel();
  max.vestir(VESTUARIO_AXEL);
  max.ojosCerrados = true;
  max.tendido = true;
  return max;
}

// ---- dialogo con Daniel (tecla E)
function hablarConDaniel() {
  if (!dialogo) {
    const lineas = misionesAceptadas
      ? ["Recuerda: cumple todos los objetivos del panel y aparecerá la salida. Yo te espero aquí."]
      : GUIONES[nivel];
    dialogo = { lineas, i: 0 };
    sonido.recoger();
  } else if (++dialogo.i >= dialogo.lineas.length) {
    dialogo = null;
    cerrarDialogo();
    if (!misionesAceptadas) {
      misionesAceptadas = true;
      sonido.recoger();
      decir("Misiones recibidas: revisa el panel de la izquierda.", 4);
    }
    return;
  } else if (CINEMATICAS[nivel][dialogo.i] && !cinesHechas.has(`${nivel}:${dialogo.i}`)) {
    const tipo = CINEMATICAS[nivel][dialogo.i];   // cada cinematica se ve una sola vez
    cinesHechas.add(`${nivel}:${dialogo.i}`);
    if (tipo === "avion") cinematicasVistas.add(nivel);
    cerrarDialogo();
    estado = "cinematica";
    const opciones = { scene, camera, sonido, crearMax: crearMaxInconsciente };
    cine = tipo === "avion" ? crearCinematicaAvion(opciones) : crearCinematicaPlaya(opciones);
    return;
  }
  mostrarLinea(dialogo);
}

// Zona disparadora radial: al llegar al bote se pasa al siguiente nivel (o se vuelve a casa)
function revisarPortal() {
  const p = mundo.portal;
  if (!p.activo || !puedeTeletransportar || !jugador.vivo || cambiandoNivel) return;
  if (Math.hypot(jugador.pos.x - p.x, jugador.pos.z - p.z) > p.radio) return;
  puedeTeletransportar = false;
  setTimeout(() => (puedeTeletransportar = true), 3000);
  if (nivel === NIVELES.length - 1) {
    terminar("victoria");
    return;
  }
  sonido.victoria();
  cambiandoNivel = true;
  fundido.style.opacity = 1;
  setTimeout(async () => {
    if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (estado === "victoria" || estado === "derrota"))) {
      cambiandoNivel = false;
      return;
    }
    const anterior = nivel;
    await empezarNivel(anterior + 1);
    if (!jugador.vivo || (typeof esTerminal === "function" ? esTerminal() : (estado === "victoria" || estado === "derrota")) || nivel !== anterior + 1) return;
    decir(`${NIVELES[nivel].nombre}: reúne ${IDOLOS_POR_NIVEL} ídolos y cumple los objetivos.`, 6);
    fundido.style.opacity = 0;
  }, 700);
}

// ============================================================
// 6. MECANICAS
// ============================================================
function atacar() {
  if (!jugador.vivo || jugador.golpeCooldown > 0 || jugador.nadando) return;
  if (jugador.arma?.tipo === "pistola") {      // con pistola dispara en vez de golpear
    jugador.golpeCooldown = 0.35;
    dispararJugador({ axel, jugador, enemigos, sonido, vista, obj, scene, mundo });
    suministros.gastarBala(axel);
    return;
  }
  if (jugador.arma) axel.brazoGolpe = "I";     // golpea con la mano derecha, donde lleva el arma
  if (!axel.golpear()) return;
  jugador.golpeCooldown = DURACION_GOLPE + 0.05;
  jugador.golpePendiente = INSTANTE_IMPACTO; // el puño conecta cuando el brazo se estira
  sonido.golpe();
}

// `mortal`: balazo en cabeza o pecho (mata al instante, aunque este invulnerable); `zona`: donde pego
// `empuje`: hacia donde empuja el ataque (decide como cae); `herida`: { parte, lado } para la animacion de dolor
function danar(cantidad, mortal = false, zona = "", empuje = null, herida = null) {
  if (!jugador.vivo || cambiandoNivel || dialogo || estado !== "jugando" || (jugador.invulnerable > 0 && !mortal)) return;
  if (zona) decir(`Disparo en ${zona}`, 2);
  jugador.vida = mortal ? 0 : Math.max(0, jugador.vida - cantidad);
  jugador.invulnerable = 0.6;
  axel.destello();
  sonido.dolor();
  vista.sacudida = 0.3;
  hud.dano.style.opacity = 1;
  setTimeout(() => (hud.dano.style.opacity = 0), 250);

  if (jugador.vida <= 0) matarJugador(empuje);   // cae segun por donde le llego el ataque
  else if (herida) axel.herir(herida.parte, herida.lado);
}

function matarJugador(empuje) {
  if (!jugador.vivo) return;
  jugador.vivo = false;
  axel.morir(undefined, empuje);
  sonido.derrota();
  setTimeout(() => terminar("derrota"), 1500);
}

// Escena final: Max descansa en su cabaña mientras la camara gira alrededor, como en el menu.
async function irACasa() {
  for (const o of mundo.objetos) o.visible = false;
  for (const e of enemigos) scene.remove(e.humano.grupo);
  enemigos.length = 0;
  if (daniel) scene.remove(daniel.grupo);
  cajaDialogo.style.display = avisoHablar.style.display = "none";
  mundo.ocultarPortal();
  jugador.pos.set(5000, 0, 5000 - 0.9);
  axel.grupo.position.set(5000, 0, 5000);
  await montarEscenaFinal({ scene, gltfLoader, jugador, axel });
}

function terminar(resultado) {
  if (estado === "victoria" || estado === "derrota") return;
  estado = resultado;
  document.exitPointerLock?.();
  const segundos = Math.round(tiempoFinal);
  if (resultado === "victoria") {
    sonido.victoria();
    irACasa();
    cuenta.registrarVictoria(segundos);          // mejor tiempo y progreso de la cuenta
  }
  pantallaFinal(resultado, segundos, NIVELES.length);
}

// Escribir en el DOM cada cuadro fuerza al navegador a recalcular el diseno aunque el valor no haya
// cambiado: estos ayudantes solo tocan el elemento cuando el valor es distinto.
const ultimoTexto = new WeakMap(), ultimoAncho = new WeakMap();
function ponerTexto(el, texto) {
  if (ultimoTexto.get(el) === texto) return;
  ultimoTexto.set(el, texto);
  el.textContent = texto;
}
function ponerAncho(el, pct) {
  const v = Math.round(pct * 10) / 10;          // una decima de por ciento basta para una barra
  if (ultimoAncho.get(el) === v) return;
  ultimoAncho.set(el, v);
  el.style.width = `${v}%`;
}

const _adelante = new THREE.Vector2(), _derecha = new THREE.Vector2(), _dir = new THREE.Vector2();
function actualizarCombateJugador(dt) {
  jugador.golpeCooldown -= dt;
  jugador.invulnerable -= dt;

  if (jugador.golpePendiente >= 0) {
    jugador.golpePendiente -= dt;
    if (jugador.golpePendiente < 0) resolverGolpe({ axel, jugador, enemigos, sonido, vista, obj });
  }
}

function moverJugador(dt) {
  // ---- direccion de movimiento relativa a la camara
  const adelante = _adelante.set(-Math.sin(vista.yaw), -Math.cos(vista.yaw));   // vectores reutilizados: nada de crear objetos cada cuadro
  const derecha = _derecha.set(Math.cos(vista.yaw), -Math.sin(vista.yaw));
  let ix = 0, iz = 0;
  if (jugador.vivo && !dialogo) {
    if (teclas["w"]) iz += 1;
    if (teclas["s"]) iz -= 1;
    if (teclas["d"]) ix += 1;
    if (teclas["a"]) ix -= 1;
    if (teclas["arrowleft"]) vista.yaw += 1.8 * dt;
    if (teclas["arrowright"]) vista.yaw -= 1.8 * dt;
    if (teclas["arrowup"]) vista.pitch = Math.max(-0.15, vista.pitch - 1.2 * dt);
    if (teclas["arrowdown"]) vista.pitch = Math.min(1.15, vista.pitch + 1.2 * dt);
    if (tactil) { ix += tactil.mov.x; iz += tactil.mov.y; }     // joystick en pantalla
  }

  const dir = _dir.set(0, 0)
    .addScaledVector(adelante, iz)
    .addScaledVector(derecha, ix);
  const moviendo = dir.lengthSq() > 0;
  if (moviendo) dir.normalize();

  const correr = teclas["shift"] || (tactil && tactil.correr);
  const vAgua = mundo.agua ? mundo.agua.velocidad : null;   // cada masa de agua tiene su ritmo
  const rapidez = moviendo ? (jugador.nadando ? (correr ? vAgua.rapido : vAgua.nadar) : correr ? 6.4 : 3.4) : 0;
  const k = Math.min(1, dt * (moviendo ? 12 : 9));
  jugador.vel.x += (dir.x * rapidez - jugador.vel.x) * k;
  jugador.vel.z += (dir.y * rapidez - jugador.vel.z) * k;

  // ---- mover (no se puede entrar al mar)
  const nx = jugador.pos.x + jugador.vel.x * dt;
  const nz = jugador.pos.z + jugador.vel.z * dt;
  if (mundo.dentroDelMapa(nx, nz)) {          // el mar se nada hasta el limite del mapa
    jugador.pos.x = nx;
    jugador.pos.z = nz;
  } else if (mundo.dentroDelMapa(nx, jugador.pos.z)) {
    jugador.pos.x = nx;
  } else if (mundo.dentroDelMapa(jugador.pos.x, nz)) {
    jugador.pos.z = nz;
  } else if (!metaLista && tiempo > avisoMar) {
    avisoMar = tiempo + 5;
    decir(mundo.tema.limiteTexto, 4);
  }
  mundo.resolver(jugador.pos, 0.42);

  // ---- salto y gravedad
  const suelo = mundo.altura(jugador.pos.x, jugador.pos.z);
  const estabaNadando = jugador.nadando;
  // histeresis: entra al agua con fondo > 0.45 m y sale con menos de 0.15 m (evita parpadeos en la orilla)
  jugador.nadando = mundo.agua ? mundo.agua.contiene(jugador.pos.x, jugador.pos.z, estabaNadando) : false;
  if (estabaNadando && !jugador.nadando) sonido.chapoteo(0.5);   // sale del agua
  if (jugador.nadando) {
    // en el agua se flota: sin gravedad ni salto
    if (!estabaNadando) sonido.chapoteo(1);
    jugador.vy = 0;
    jugador.enSuelo = true;
    // el cuerpo tendido flota con la espalda a ras de la ola (sigue su altura real)
    const objetivoY = mundo.agua.superficie(jugador.pos.x, jugador.pos.z, tiempo) - mundo.agua.flotacion;
    jugador.pos.y += (objetivoY - jugador.pos.y) * Math.min(1, dt * 14);
  } else {
  if (jugador.enSuelo && (teclas[" "] || (tactil && tactil.saltar)) && jugador.vivo) {
    jugador.vy = 7.2;
    jugador.enSuelo = false;
    sonido.salto();
  }
  jugador.vy -= 19 * dt;
  jugador.pos.y += jugador.vy * dt;
  if (jugador.pos.y <= suelo) {
    if (!jugador.enSuelo && jugador.vy < -6) sonido.aterrizaje();
    jugador.pos.y = suelo;
    jugador.vy = 0;
    jugador.enSuelo = true;
  } else if (jugador.pos.y > suelo + 0.15) {
    jugador.enSuelo = false;
  }
  }
}

function actualizarAnimacionJugador(dt) {
  // ---- orientacion y animacion
  const velocidadH = Math.hypot(jugador.vel.x, jugador.vel.z);
  if (jugador.vivo) {
    if (jugador.golpePendiente >= 0 || axel.golpeT >= 0) {
      axel.mirarHacia(vista.yaw + Math.PI, dt, 18); // al pelear mira hacia donde apunta la camara
    } else if (velocidadH > 0.3) {
      axel.mirarHacia(Math.atan2(jugador.vel.x, jugador.vel.z), dt);
    }
  }
  axel.grupo.position.copy(jugador.pos);
  axel.actualizar(dt, velocidadH, jugador.enSuelo, tiempo, jugador.vy, jugador.nadando && mundo.agua.tipo,   // "mar" = crol, "oasis" = braza
      // sombrero: no en la montaña; se la pone tras la cinematica
      mundo.tema.sombrero === false ? "oculto" : nivel > 0 || cinematicasVistas.has(0) ? "cabeza" : "mano");

  // pasos sincronizados con las piernas
  const medioPaso = Math.floor(axel.fase / Math.PI);
  if (medioPaso !== pasoAnterior) {
    pasoAnterior = medioPaso;
    if (jugador.enSuelo && !jugador.nadando && velocidadH > 1) sonido.paso();
  }
  // brazadas al nadar (una cada ~0.6 s, mas seguidas si nada rapido)
  if (jugador.nadando && velocidadH > 0.4 && tiempo > proximaBrazada) {
    proximaBrazada = tiempo + (velocidadH > 2.5 ? 0.45 : 0.7);
    sonido.brazada();
  }
  return velocidadH;
}

// 0..1: 1 si Max esta en el agua, baja hasta 0 a ~22 m de la orilla mas cercana
const DIRS_AGUA = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
function cercaniaAgua() {
  const { x, z } = jugador.pos;
  if (jugador.nadando || mundo.altura(x, z) < mundo.agua.nivel) return 1;
  for (let d = 2; d <= 22; d += d < 8 ? 2 : 4) {
    for (const [dx, dz] of DIRS_AGUA) {
      if (mundo.altura(x + dx * d, z + dz * d) < mundo.agua.nivel) return 1 - d / 24;
    }
  }
  return 0;
}

function actualizarEntornoJugador(dt) {
  // ---- fogata: da calor (ya no cura; la vida se recupera con botiquines)
  let dFuego = Infinity;                       // el sonido sigue al fuego mas cercano (las antorchas suenan menos)
  for (const f of mundo.fuegos) {
    const d = Math.hypot(jugador.pos.x - f.grupo.position.x, jugador.pos.z - f.grupo.position.z);
    dFuego = Math.min(dFuego, d / (f.escala >= 1 ? 1 : 0.6));
  }
  sonido.ajustarFuego(dFuego);
  if (tiempo > proximoSondeoAgua) {            // cercania al agua: se busca la orilla en 8 direcciones
    proximoSondeoAgua = tiempo + 0.2;
    sonido.ajustarAgua(mundo.agua ? mundo.agua.tipo : null, mundo.agua ? cercaniaAgua() : 0);
  }

  // ---- frio de la montaña: sin calor te congelas y pierdes vida
  const congelaba = frio.congelando;
  const danoFrio = frio.actualizar(dt, frio.cercaDelFuego(jugador.pos, mundo.fuegos));
  if (jugador.vivo && danoFrio > 0) {
    jugador.vida = Math.max(0, jugador.vida - danoFrio * dt);
    hud.dano.style.opacity = 0.3;
    if (jugador.vida <= 0) matarJugador();
  } else if (congelaba) {
    hud.dano.style.opacity = 0;
  }
  if (frio.activo && frio.frio > 60 && tiempo > avisoFrio) {
    avisoFrio = tiempo + 12;
    decir("¡Te estás congelando! Acércate a una fogata o antorcha.", 4);
  }

  suministros.actualizar(dt, tiempo, mundo, axel);   // botiquines y kits de arma
}

function actualizarObjetivosJugador(dt, velocidadH) {
  // ---- idolos
  let mas = Infinity;
  for (const id of mundo.idolos) {
    if (id.recogido) continue;
    const d = Math.hypot(jugador.pos.x - id.x, jugador.pos.z - id.z);
    mas = Math.min(mas, d);
    if (d < 1.5 && jugador.vivo) {
      id.recogido = true;
      id.obj.visible = id.brillo.visible = false;
      id.luz.intensity = 0;
      obj.idolos++;
      sonido.recoger();
      decir(`Ídolo recogido (${obj.idolos}/${IDOLOS_POR_NIVEL})`, 2.5);
    }
  }

  // ---- objetivos sencillos: fogata, altar y nado
  if (mundo.fogata && Math.hypot(jugador.pos.x - mundo.fogata.x, jugador.pos.z - mundo.fogata.z) < 3.4) obj.fogata = true;
  if (Math.hypot(jugador.pos.x - mundo.altar.x, jugador.pos.z - mundo.altar.z) < 4.2) obj.altar = true;
  if (jugador.nadando && mundo.agua.tipo === "oasis") obj.nado += velocidadH * dt;   // solo cuenta nadar en el oasis

  const lista = objetivos(nivel, obj);
  if (!metaLista && misionesAceptadas && lista.every(([, ok]) => ok)) {
    metaLista = true;
    mundo.activarAltar();
    mundo.mostrarPortal(mundo.salida.x, mundo.salida.z, mundo.tema.vehiculo);
    sonido.recoger();
    decir("¡Objetivos cumplidos! " + mundo.tema.salidaTexto, 7);
  }
  pintarObjetivos(misionesAceptadas ? lista : [["Habla con Daniel (E) para recibir tus misiones", false]]);
}

function actualizarIndicadoresJugador(dt) {
  // Daniel mira a Axel y avisa cuando esta cerca
  const dDaniel = Math.hypot(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z);
  daniel.mirarHacia(Math.atan2(jugador.pos.x - danielPos.x, jugador.pos.z - danielPos.z), dt, 6);
  avisoHablar.style.display = dDaniel < 3.6 && !dialogo && jugador.vivo && !tactil ? "block" : "none";
  tactil?.mostrarHablar(jugador.vivo && (dDaniel < 3.6 || !!dialogo));
  tactil?.textoGolpe(jugador.arma?.tipo === "pistola" ? "DISPARAR" : "GOLPEAR");
  if (metaLista) {
    const dMeta = Math.hypot(jugador.pos.x - mundo.portal.x, jugador.pos.z - mundo.portal.z);
    ponerTexto(hud.pista, `Salida: ${Math.round(dMeta)} m`);
    revisarPortal();
  } else if (!misionesAceptadas) {
    ponerTexto(hud.pista, `Daniel: ${Math.round(dDaniel)} m`);
  } else {
    let mas = Infinity;
    for (const id of mundo.idolos) {
      if (!id.recogido) mas = Math.min(mas, Math.hypot(jugador.pos.x - id.x, jugador.pos.z - id.z));
    }
    const nadoPendiente = NIVELES[nivel].extras.includes("nadar") && obj.nado < METROS_NADO;
    if (nadoPendiente && mundo.oasis && obj.idolos >= IDOLOS_POR_NIVEL) {
      ponerTexto(hud.pista, `Oasis: ${Math.round(Math.hypot(jugador.pos.x - mundo.oasis.x, jugador.pos.z - mundo.oasis.z))} m`);
    } else {
      ponerTexto(hud.pista, mas < Infinity ? `Ídolo más cercano: ${Math.round(mas)} m` : "");
    }
  }
}

function actualizarHudJugador() {
  // ---- HUD
  ponerAncho(hud.barraVida, jugador.vida);
  hud.barraVida.classList.toggle("baja", jugador.vida < 35);
  if (frio.activo) {
    ponerAncho(hud.barraFrio, frio.frio);
    hud.barraFrio.classList.toggle("critico", frio.frio > 60);
    ponerAncho(hud.barraCalor, frio.calor);
  }
}

function actualizarJugador(dt) {
  actualizarCombateJugador(dt);
  moverJugador(dt);
  const velocidadH = actualizarAnimacionJugador(dt);
  actualizarEntornoJugador(dt);
  actualizarObjetivosJugador(dt, velocidadH);
  actualizarIndicadoresJugador(dt);
  actualizarHudJugador();
}
// ============================================================
// 8. BUCLE PRINCIPAL
// ============================================================
let ultimoCuadro = performance.now();
const humanosEnEscena = [];            // reutilizada cada cuadro (sin crear listas nuevas)

function animar() {
  requestAnimationFrame(animar);
  const ahora = performance.now();
  resolucion.medir(ahora - ultimoCuadro, estado === "jugando");
  const dt = Math.min((ahora - ultimoCuadro) / 1000, 0.05);
  ultimoCuadro = ahora;
  tiempo += dt;

  tactil?.activar(estado === "jugando");
  if (mundo) {
    if (estado === "jugando") {
      tiempoFinal += dt;
      actualizarJugador(dt);
    } else if (axel) {
      axel.actualizar(dt, 0, true, tiempo); // Axel respira en el menu
    }

    if (estado === "jugando" || estado === "victoria" || estado === "derrota") {
      jugador.direccion = axel.direccion;   // los enemigos lo necesitan para saber a que lado le pega la bala
      humanosEnEscena.length = 0;           // oculta (y deja de animar) a los que no se ven
      for (const e of enemigos) humanosEnEscena.push(e.humano);
      if (daniel) humanosEnEscena.push(daniel);
      gestionarPersonajes(camera, humanosEnEscena, jugador.pos);
      if (!dialogo && !cambiandoNivel) {
        for (const e of enemigos) e.actualizar(dt, tiempo, jugador, danar, sonido);
        separarEnemigos(enemigos, jugador, mundo);   // no se atraviesan entre si ni a Max
      }
      for (let i = enemigos.length - 1; i >= 0; i--) {
        if (enemigos[i].quitar) {
          scene.remove(enemigos[i].humano.grupo);
          enemigos[i].limpiar();
          enemigos.splice(i, 1);
        }
      }
    }

    if (daniel && daniel.activo !== false) daniel.actualizar(dt, 0, true, tiempo);
    mundo.actualizar(tiempo, dt, jugador.pos);
    const ctx = { estado, jugador, mundo, axel, tiempo };
    vista.iluminarRostro(dt, ctx);
    if (!cine) vista.actualizar(dt, ctx);
    else if (estado !== "pausa" && !cine.actualizar(dt)) {   // termino la cinematica: volver al dialogo
      cine = null;
      estado = "jugando";
      camera.position.copy(jugador.pos);
      mostrarLinea(dialogo);
    }
    mundo.seguirCamara(camera.position);
  }

  renderer.render(scene, camera);
}

iniciar().catch((err) => {
  console.error(err);
  hud.texto.textContent = "Error al cargar el juego. Revisa la consola (F12).";
});
animar();
