// Las credenciales, sesiones y el progreso persistente son responsabilidad del backend.
// Este módulo conserva el estado de interfaz y adapta las acciones del juego a la API.
import * as api from './apiCliente.js';

let actual = null;                // { nombre, remoto, datos } | { invitado: true } | null
let ui = null;                    // modulo de la pantalla (se carga en sesion())
let cola = Promise.resolve();     // los guardados se hacen de uno en uno

const error = (mensaje) => ({ ok: false, mensaje });

export async function registrar(nombre, password) {
  const r = await api.registrarEnServidor(nombre, password);
  if (!r.ok) return error(r.mensaje);
  actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
  return { ok: true };
}

export async function entrar(nombre, password) {
  const r = await api.entrarEnServidor(nombre, typeof password === "string" ? password : "");
  if (!r.ok) return error(r.mensaje);
  actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
  return { ok: true };
}

export function entrarComoInvitado() {
  actual = { invitado: true };
}

export async function cerrarSesion() {
  if (actual?.remoto) {
    const r = await api.cerrarSesionEnServidor();
    if (!r.ok) return error(r.mensaje);
  }
  actual = null;
  return { ok: true };
}

function guardar(metaRemota = {}) {
  const cuenta = actual;
  if (!cuenta?.remoto) return;
  cola = cola.then(async () => {
    if (actual !== cuenta) return;
    const r = await api.actualizarProgresoEnServidor(metaRemota);
    if (actual !== cuenta) return;
    if (!r.ok) cuenta.aviso = r.mensaje;
    else {
      cuenta.datos = r.datos;
      cuenta.aviso = null;
    }
    ui?.mostrarInfo(cuenta, cerrarDesdeUI);
  });
}

export const guardarNivel = (n) => {
  const nivelLimpio = Math.max(0, Math.min(2, n | 0));
  guardar({ nivel: nivelLimpio });
};
export function registrarVictoria(segundos) {
  const t = Number.isFinite(segundos) && segundos >= 1 ? Math.min(Math.round(segundos), 86400) : null;
  guardar({ nivel: 0, tiempoVictoria: t });
}
export const nivelGuardado = () => actual?.datos?.nivel ?? 0;
export const usuario = () => actual;

async function cerrarDesdeUI() {
  const r = await cerrarSesion();
  if (r.ok) {
    location.reload();
    return;
  }
  if (actual) actual.aviso = r.mensaje;
  ui?.mostrarInfo(actual, cerrarDesdeUI);
}

export async function sesion() {
  const r = await api.sesionEnServidor();
  if (r.ok) actual = { nombre: r.nombre, remoto: true, datos: { ...r.datos }, aviso: r.aviso };
  else if (r.status !== 401) actual = { sinConexion: r.mensaje };

  ui = await import('./pantalla.js');
  if (!actual || actual.sinConexion) {
    await ui.mostrarPantallaCuenta({
      registrar,
      entrar,
      entrarComoInvitado,
      mensajeInicial: actual?.sinConexion,
    });
  }
  ui.mostrarInfo(actual, cerrarDesdeUI);
  return actual;
}
