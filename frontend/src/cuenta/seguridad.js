// Criptografia del inicio de sesion (API estandar del navegador: SubtleCrypto, sin librerias).
//   - La contraseña NUNCA se guarda: se guarda un verificador, resultado de PBKDF2-SHA256
//     (150 000 vueltas, sal aleatoria de 16 bytes por usuario).
//   - PBKDF2 entrega 512 bits: los primeros 256 son el verificador (se guarda) y los otros 256
//     son la clave de firma, que NO se guarda: solo existe mientras la sesion esta abierta.
//   - Los datos de cada usuario llevan una firma HMAC-SHA256 hecha con esa clave. Quien edite el
//     localStorage a mano no puede recalcular la firma sin la contraseña, asi que se detecta.
// Limite real: todo corre en el navegador, asi que esto protege contra edicion casual y contra
// leer contraseñas del almacenamiento; no contra alguien que borre los datos o tenga el equipo.
const VUELTAS = 150000;
const enc = new TextEncoder();

export const disponible = () => !!globalThis.crypto?.subtle;   // solo en https o localhost

export const aB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const deB64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

export const salAleatoria = () => aB64(crypto.getRandomValues(new Uint8Array(16)));

export async function derivar(password, sal) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: deB64(sal), iterations: VUELTAS }, base, 512));
  return { verificador: aB64(bits.slice(0, 32)), clave: aB64(bits.slice(32)) };
}

// comparacion que tarda lo mismo aunque el primer caracter ya difiera
export function iguales(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// el texto firmado tiene un orden fijo de campos, asi no depende de como se serialice el JSON
const canonico = (nombre, d) => [1, nombre, d.nivel, d.mejorTiempo ?? "", d.victorias].join("|");
const claveHmac = (clave) => crypto.subtle.importKey("raw", deB64(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function firmar(clave, nombre, datos) {
  return aB64(await crypto.subtle.sign("HMAC", await claveHmac(clave), enc.encode(canonico(nombre, datos))));
}

export async function firmaValida(clave, nombre, datos, firma) {
  try {
    return await crypto.subtle.verify("HMAC", await claveHmac(clave), deB64(firma), enc.encode(canonico(nombre, datos)));
  } catch { return false; }   // firma con formato roto
}
