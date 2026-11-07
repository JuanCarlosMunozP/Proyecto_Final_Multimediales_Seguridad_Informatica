// Inicio de sesion con dos modos explícitos (ARCH-DEPLOY-001):
//   - modo "local" (por defecto): localStorage + Web Crypto API (sin servidor)
//   - modo "server" (VITE_AUTH_MODE=server): API REST /api/v1 (FastAPI + PostgreSQL) sin fallback silencioso
// Las reglas de proteccion estan explicadas en seguridad.js y apiCliente.js:
//   - validacion de nombre y contraseña, mensajes de error que no revelan si el usuario existe
//   - bloqueo temporal tras 3 intentos fallidos (se duplica la espera, tope de 5 minutos)
//   - cada guardado vuelve a firmar los datos; si la firma no coincide, se restablecen
// main.js solo usa: sesion(), nivelGuardado(), guardarNivel(n) y registrarVictoria(segundos).
import * as seg from './seguridad.js';
import * as alm from './almacen.js';
import * as api from './apiCliente.js';

const MIN_CLAVE = 6;
const GRATIS = 3;                 // intentos fallidos antes de empezar a bloquear
const DATOS_NUEVOS = () => ({ nivel: 0, mejorTiempo: null, victorias: 0 });
const esModoServidor = () => api.modoCuentaActual() === api.MODOS_CUENTA.SERVER;

let actual = null;                // { nombre, clave?, remoto?, datos } | { invitado: true } | null
let ui = null;                    // modulo de la pantalla (se carga en sesion())
let cola = Promise.resolve();     // los guardados se hacen de uno en uno

const error = (mensaje) => ({ ok: false, mensaje });
const buscar = (usuarios, nombre) => usuarios.find((u) => alm.llave(u.nombre) === alm.llave(nombre));

function validar(nombre, password) {
  if (!alm.NOMBRE_VALIDO.test(nombre)) return "El nombre debe tener de 3 a 16 letras, números, espacios, - o _.";
  if (typeof password !== "string" || password.length < MIN_CLAVE) return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`;
  if (password.length > 64) return "La contraseña es demasiado larga (máximo 64).";
  return null;
}

function abrirSesion(registro, clave) {
  actual = { nombre: registro.nombre, clave, datos: { ...registro.datos } };
  alm.guardarSesion({ nombre: registro.nombre, clave });
}

export async function registrar(nombre, password) {
  nombre = nombre.trim();
  const problema = validar(nombre, password);
  if (problema) return error(problema);
  if (esModoServidor()) {
    const r = await api.registrarEnServidor(nombre, password);
    if (!r.ok) return error(r.mensaje);
    actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
    return { ok: true };
  }
  if (!seg.disponible()) return error("Este navegador no permite guardar cuentas seguras (hace falta https o localhost). Juega como invitado.");
  const usuarios = alm.leerUsuarios();
  if (buscar(usuarios, nombre)) return error("Ese nombre ya está en uso.");
  const salUsuario = seg.salAleatoria();
  const { verificador, clave } = await seg.derivar(password, salUsuario);
  const datos = DATOS_NUEVOS();
  const registro = { nombre, sal: salUsuario, verificador, datos, firma: await seg.firmar(clave, nombre, datos) };
  if (!alm.guardarUsuarios([...usuarios, registro])) return error("No se pudo guardar: el navegador bloquea el almacenamiento.");
  abrirSesion(registro, clave);
  return { ok: true };
}

export async function entrar(nombre, password) {
  nombre = nombre.trim();
  if (esModoServidor()) {
    const r = await api.entrarEnServidor(nombre, typeof password === "string" ? password : "");
    if (!r.ok) return error(r.mensaje);
    actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
    return { ok: true };
  }
  if (!seg.disponible()) return error("Este navegador no permite cuentas seguras. Juega como invitado.");
  const intentos = alm.leerIntentos();
  const marca = "u:" + alm.llave(nombre);
  const fallos = intentos[marca];
  const espera = fallos?.hasta > Date.now() ? Math.ceil((fallos.hasta - Date.now()) / 1000) : 0;
  if (espera) return error(`Demasiados intentos. Espera ${espera} s.`);

  const usuarios = alm.leerUsuarios();
  const registro = buscar(usuarios, nombre);
  // si el usuario no existe se hace igual el calculo, asi no se nota por el tiempo de respuesta
  const { verificador, clave } = await seg.derivar(typeof password === "string" ? password : "", registro?.sal ?? seg.salAleatoria());
  if (!registro || !seg.iguales(verificador, registro.verificador)) {
    const n = (Number.isInteger(fallos?.n) ? fallos.n : 0) + 1;
    const bloqueo = n >= GRATIS ? Math.min(2 ** (n - GRATIS) * 5000, 300000) : 0;
    intentos[marca] = { n, hasta: Date.now() + bloqueo };
    alm.guardarIntentos(intentos);
    return error("Nombre o contraseña incorrectos.");
  }
  delete intentos[marca];
  alm.guardarIntentos(intentos);

  let aviso = null;
  if (!(await seg.firmaValida(clave, registro.nombre, registro.datos, registro.firma))) {
    registro.datos = DATOS_NUEVOS();           // los datos no coinciden con su firma: alguien los editó
    registro.firma = await seg.firmar(clave, registro.nombre, registro.datos);
    alm.guardarUsuarios(usuarios);
    aviso = "Los datos guardados de esta cuenta fueron modificados y se restablecieron.";
  }
  abrirSesion(registro, clave);
  actual.aviso = aviso;                        // se muestra en el menu
  return { ok: true };
}

export function entrarComoInvitado() {
  actual = { invitado: true };
  alm.guardarSesion({ invitado: true });
}

export function cerrarSesion() {
  if (actual?.remoto) api.cerrarSesionEnServidor();
  actual = null;
  alm.borrarSesion();
}

// Guarda los datos de la cuenta abierta (nivel, mejor tiempo...) con firma nueva. No hace nada en invitado.
function guardar(cambios, metaRemota = {}) {
  if (!actual?.clave && !actual?.remoto) return;
  const datos = { ...actual.datos, ...cambios };
  actual.datos = datos;
  cola = cola.then(async () => {
    if (actual?.remoto) {
      const r = await api.actualizarProgresoEnServidor(metaRemota);
      if (r.ok && actual) actual.datos = r.datos;
    } else {
      const usuarios = alm.leerUsuarios();
      const registro = buscar(usuarios, actual.nombre);
      if (!registro) return;
      registro.datos = datos;
      registro.firma = await seg.firmar(actual.clave, registro.nombre, datos);
      alm.guardarUsuarios(usuarios);
    }
    if (actual) ui?.mostrarInfo(actual, () => { cerrarSesion(); location.reload(); });
  }).catch(() => {});                          // si falla el guardado, el juego sigue igual
}

export const guardarNivel = (n) => {
  const nivelLimpio = Math.max(0, Math.min(2, n | 0));
  guardar({ nivel: nivelLimpio }, { nivel: nivelLimpio });
};
export function registrarVictoria(segundos) {
  const t = Number.isFinite(segundos) && segundos >= 1 ? Math.min(Math.round(segundos), 86400) : null;
  const mejor = actual?.datos?.mejorTiempo ?? null;
  guardar(
    { nivel: 0, victorias: (actual?.datos?.victorias ?? 0) + 1, mejorTiempo: t && (mejor === null || t < mejor) ? t : mejor },
    { nivel: 0, tiempoVictoria: t }
  );
}
export const nivelGuardado = () => actual?.datos?.nivel ?? 0;
export const usuario = () => actual;

// Recupera la sesion de esta pestaña (sirve cuando el juego recarga la pagina) o muestra la pantalla
// de ingreso. Resuelve cuando hay usuario o invitado; despues deja los datos del jugador en el menu.
export async function sesion() {
  const guardada = alm.leerSesion();
  if (guardada?.invitado) actual = { invitado: true };
  else if (esModoServidor()) {
    const r = await api.sesionEnServidor();
    if (r.ok) actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
  } else if (typeof guardada?.nombre === "string" && typeof guardada?.clave === "string") {
    const registro = buscar(alm.leerUsuarios(), guardada.nombre);
    if (registro && await seg.firmaValida(guardada.clave, registro.nombre, registro.datos, registro.firma)) abrirSesion(registro, guardada.clave);
    else alm.borrarSesion();
  }
  ui = await import('./pantalla.js');                  // la pantalla se carga aparte (el codigo de arriba no necesita DOM)
  if (!actual) await ui.mostrarPantallaCuenta({ registrar, entrar, entrarComoInvitado, disponible: esModoServidor() || seg.disponible() });
  ui.mostrarInfo(actual, () => { cerrarSesion(); location.reload(); });
  return actual;
}
