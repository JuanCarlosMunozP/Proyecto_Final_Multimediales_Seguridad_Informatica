// Perfil del dispositivo: que tipo de pantalla/entrada tiene y cuanta calidad grafica aguanta.
//   - tactil:  moviles y tabletas (pantalla tactil como entrada principal) -> controles en pantalla.
//   - calidad: "alta" (computador), "media" (movil/tableta) o "baja" (Raspberry Pi y equipos parecidos).
// Se puede forzar con ?calidad=baja|media|alta en la direccion (se recuerda en este navegador) y
// ?calidad=auto para volver a la deteccion automatica.
const CALIDADES = ["baja", "media", "alta"];

function leerGuardado() {
  try { return localStorage.getItem("calidad"); } catch { return null; }
}
function guardar(valor) {
  try { valor ? localStorage.setItem("calidad", valor) : localStorage.removeItem("calidad"); } catch { /* sin almacenamiento */ }
}

// Nombre de la tarjeta grafica (solo para reconocer GPUs de placas pequeñas como la de la Raspberry)
function gpuDelNavegador() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const nombre = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return nombre;
  } catch { return ""; }
}

function detectarTactil() {
  const tactilPrincipal = matchMedia("(pointer: coarse)").matches && !matchMedia("(hover: hover) and (pointer: fine)").matches;
  return tactilPrincipal || (navigator.maxTouchPoints > 0 && /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent));
}

function detectarCalidad(tactil) {
  const ua = navigator.userAgent;
  const android = /Android|iPhone|iPad|iPod/i.test(ua);
  const arm = /armv[67]|aarch64|arm64/i.test(`${ua} ${navigator.platform}`);
  // Linux de escritorio con procesador ARM = Raspberry Pi (Chromium/Firefox en Raspberry Pi OS)
  const linuxArm = !android && /Linux/i.test(`${ua} ${navigator.platform}`) && arm;
  const gpu = gpuDelNavegador();
  const gpuDebil = /V3D|VideoCore|vc4|llvmpipe|SwiftShader|softpipe|Mali-4|Mali-T/i.test(gpu);
  const pocaMemoria = (navigator.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2;
  if (linuxArm || gpuDebil || pocaMemoria) return "baja";
  if (tactil) return "media";
  return "alta";
}

const consulta = new URLSearchParams(location.search).get("calidad");
if (consulta === "auto") guardar(null);
else if (CALIDADES.includes(consulta)) guardar(consulta);

const tactil = detectarTactil();
const forzada = CALIDADES.includes(consulta) ? consulta : leerGuardado();
const calidad = CALIDADES.includes(forzada) ? forzada : detectarCalidad(tactil);

// Ajustes graficos de cada nivel de calidad
const AJUSTES = {
  alta:  { pixelRatioMax: 1.5,  pixelRatioMin: 0.6,  sombra: 2048, sombras: true,  antialias: true,  segmentosTerreno: 170, copos: 1800, luzRostro: true },
  media: { pixelRatioMax: 1.25, pixelRatioMin: 0.5,  sombra: 1024, sombras: true,  antialias: false, segmentosTerreno: 150, copos: 1000, luzRostro: true },
  baja:  { pixelRatioMax: 1,    pixelRatioMin: 0.4,  sombra: 512,  sombras: true,  antialias: false, segmentosTerreno: 120,  copos: 500,  luzRostro: false }
};

export const dispositivo = { tactil, calidad, ...AJUSTES[calidad] };

// Clases en <html> para que el CSS se adapte (html.tactil, html.calidad-baja)
document.documentElement.classList.toggle("tactil", tactil);
document.documentElement.classList.add(`calidad-${calidad}`);

// Tamaño real visible: en el movil la barra del navegador cambia la altura de window.innerHeight
export function medidaVisible() {
  const v = window.visualViewport;
  return { ancho: Math.round(v?.width ?? window.innerWidth), alto: Math.round(v?.height ?? window.innerHeight) };
}

// Pantalla completa (donde el navegador la permita). En iPhone no existe: se ignora sin error.
export function pantallaCompleta() {
  const raiz = document.documentElement;
  const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  if (!pedir || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const r = pedir.call(raiz);
    r?.catch?.(() => {});
    screen.orientation?.lock?.("landscape")?.catch?.(() => {});
  } catch { /* no permitido */ }
}
