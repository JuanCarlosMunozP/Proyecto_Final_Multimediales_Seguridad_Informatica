// Acceso al localStorage con validacion estricta: lo que se lee NUNCA se da por bueno. Si el JSON
// esta roto o un registro tiene tipos o rangos raros (alguien lo edito), ese registro se descarta.
// Todo va en try/catch: el almacenamiento puede estar bloqueado (ventana privada, permisos).
const CLAVE_DATOS = "ideolo:v1:cuentas";
const CLAVE_INTENTOS = "ideolo:v1:intentos";
const CLAVE_SESION = "ideolo:v1:sesion";          // en sessionStorage: se borra al cerrar la pestaña

export const NOMBRE_VALIDO = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,16}$/;
const BASE64 = /^[A-Za-z0-9+/]{20,64}={0,2}$/;
export const llave = (nombre) => nombre.trim().toLowerCase();

const entero = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

export function registroValido(r) {
  const d = r?.datos;
  return !!r && typeof r.nombre === "string" && NOMBRE_VALIDO.test(r.nombre)
    && typeof r.sal === "string" && BASE64.test(r.sal)
    && typeof r.verificador === "string" && BASE64.test(r.verificador)
    && typeof r.firma === "string" && BASE64.test(r.firma)
    && !!d && entero(d.nivel, 0, 2) && entero(d.victorias, 0, 100000)
    && (d.mejorTiempo === null || (Number.isFinite(d.mejorTiempo) && d.mejorTiempo >= 1 && d.mejorTiempo <= 86400));
}

function leerJSON(almacen, clave) {
  try {
    const bruto = almacen.getItem(clave);
    return bruto ? JSON.parse(bruto) : null;
  } catch { return null; }
}

function escribirJSON(almacen, clave, valor) {
  try { almacen.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
}

// lista de usuarios (array, no objeto: asi un nombre como "__proto__" no puede causar problemas)
export function leerUsuarios() {
  const db = leerJSON(localStorage, CLAVE_DATOS);
  const lista = db?.v === 1 && Array.isArray(db.usuarios) ? db.usuarios : [];
  return lista.filter(registroValido);
}
export const guardarUsuarios = (usuarios) => escribirJSON(localStorage, CLAVE_DATOS, { v: 1, usuarios });

// intentos fallidos por usuario: { [nombre]: { n, hasta } }
export const leerIntentos = () => {
  const o = leerJSON(localStorage, CLAVE_INTENTOS);
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
};
export const guardarIntentos = (o) => escribirJSON(localStorage, CLAVE_INTENTOS, o);

export const leerSesion = () => leerJSON(sessionStorage, CLAVE_SESION);
export const guardarSesion = (s) => escribirJSON(sessionStorage, CLAVE_SESION, s);
export function borrarSesion() { try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ } }
