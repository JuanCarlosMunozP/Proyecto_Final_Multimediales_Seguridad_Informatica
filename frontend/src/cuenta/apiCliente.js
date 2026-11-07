// ARCH-DEPLOY-001 — Cliente de Cuentas con dos modos explícitos: "local" y "server".
// Regla de seguridad obligatoria:
//   - En modo "local": opera exclusivamente con Web Crypto API + localStorage (comportamiento actual).
//   - En modo "server": opera exclusivamente contra /api/v1/* (FastAPI + PostgreSQL) usando cookies
//     HttpOnly + token anti-CSRF (X-CSRF-Token). Si la API falla o no responde, NO hace fallback
//     silencioso a localStorage: devuelve un error explícito y seguro.
// Nota: Conectado a cuenta.js mediante selección explícita de modo (MODOS_CUENTA.LOCAL | MODOS_CUENTA.SERVER).

export const MODOS_CUENTA = Object.freeze({
  LOCAL: "local",
  SERVER: "server",
});

function leerModoPorDefecto() {
  const envModo = typeof import.meta !== "undefined" && import.meta.env?.VITE_AUTH_MODE;
  return envModo === MODOS_CUENTA.SERVER ? MODOS_CUENTA.SERVER : MODOS_CUENTA.LOCAL;
}

let modoActual = leerModoPorDefecto();
let csrfTokenMemoria = null;
let fetchImpl = (...args) => globalThis.fetch(...args);

export function modoCuentaActual() {
  return modoActual;
}

export function tokenCsrfActual() {
  return csrfTokenMemoria;
}

export function configurarClienteApi({ modo = null, fetchFn = null, csrfToken = undefined } = {}) {
  if (modo === MODOS_CUENTA.LOCAL || modo === MODOS_CUENTA.SERVER) {
    modoActual = modo;
  }
  if (fetchFn) fetchImpl = fetchFn;
  if (csrfToken !== undefined) csrfTokenMemoria = csrfToken;
}

export function adaptarDatosServidor(progreso = {}) {
  const nivelApi = Number.isInteger(progreso.nivel) ? progreso.nivel : 1;
  const mejor = Number.isInteger(progreso.mejorTiempo) && progreso.mejorTiempo > 0
    ? progreso.mejorTiempo
    : null;
  return {
    nivel: Math.max(0, Math.min(2, nivelApi - 1)),
    mejorTiempo: mejor,
    victorias: Number.isInteger(progreso.victorias) && progreso.victorias >= 0 ? progreso.victorias : 0,
  };
}

async function peticionJson(ruta, metodo = "GET", cuerpo = null) {
  if (modoActual !== MODOS_CUENTA.SERVER) {
    return {
      ok: false,
      status: 0,
      codigo: "MODE_NOT_SERVER",
      mensaje: "El cliente API solo puede invocarse cuando el modo explícito es 'server'.",
    };
  }

  const headers = { Accept: "application/json" };
  if (cuerpo !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(metodo.toUpperCase()) && csrfTokenMemoria) {
    headers["X-CSRF-Token"] = csrfTokenMemoria;
  }

  let res;
  try {
    res = await fetchImpl(ruta, {
      method: metodo,
      credentials: "same-origin",
      headers,
      body: cuerpo !== null ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    // Prohibido hacer fallback silencioso a localStorage en modo server
    return {
      ok: false,
      status: 503,
      codigo: "SERVER_UNREACHABLE",
      mensaje: "No se pudo conectar con el servidor de seguridad (/api/v1). En modo 'server' no se utiliza almacenamiento local de respaldo.",
    };
  }

  const headerCsrf = res.headers?.get?.("X-CSRF-Token") || res.headers?.get?.("x-csrf-token");
  if (headerCsrf) csrfTokenMemoria = headerCsrf;

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (typeof json?.csrfToken === "string" && json.csrfToken) {
    csrfTokenMemoria = json.csrfToken;
  }

  if (!res.ok) {
    const detalle = typeof json?.detail === "string"
      ? json.detail
      : "El servidor rechazó la operación solicitada.";
    return {
      ok: false,
      status: res.status,
      codigo: res.status === 423 ? "ACCOUNT_LOCKED" : res.status === 403 ? "FORBIDDEN_OR_CSRF" : "API_ERROR",
      mensaje: detalle,
    };
  }

  return { ok: true, status: res.status, datos: json };
}

export async function registrarEnServidor(nombre, clave) {
  const r = await peticionJson("/api/v1/auth/register", "POST", { nombre, clave });
  if (!r.ok) return r;
  return {
    ok: true,
    nombre: r.datos.nombre,
    csrfToken: csrfTokenMemoria,
    datos: adaptarDatosServidor(r.datos.progreso),
    aviso: r.datos.aviso || null,
  };
}

export async function entrarEnServidor(nombre, clave) {
  const r = await peticionJson("/api/v1/auth/login", "POST", { nombre, clave });
  if (!r.ok) return r;
  return {
    ok: true,
    nombre: r.datos.nombre,
    csrfToken: csrfTokenMemoria,
    datos: adaptarDatosServidor(r.datos.progreso),
    aviso: r.datos.aviso || null,
  };
}

export async function sesionEnServidor() {
  const r = await peticionJson("/api/v1/auth/me", "GET");
  if (!r.ok) return r;
  return {
    ok: true,
    nombre: r.datos.nombre,
    csrfToken: csrfTokenMemoria,
    datos: adaptarDatosServidor(r.datos.progreso),
    aviso: r.datos.aviso || null,
  };
}

export async function actualizarProgresoEnServidor({ nivel = null, tiempoVictoria = null }) {
  const payload = {};
  if (Number.isInteger(nivel)) payload.nivel = Math.max(1, Math.min(3, nivel + 1));
  if (Number.isInteger(tiempoVictoria) && tiempoVictoria > 0) payload.tiempoVictoria = tiempoVictoria;
  const r = await peticionJson("/api/v1/progress", "PUT", payload);
  if (!r.ok) return r;
  return {
    ok: true,
    datos: adaptarDatosServidor(r.datos),
  };
}

export async function cerrarSesionEnServidor() {
  const r = await peticionJson("/api/v1/auth/logout", "POST");
  if (r.ok) csrfTokenMemoria = null;
  return r;
}
