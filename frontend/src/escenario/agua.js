// Masas de agua del juego. Cada una define sus propias reglas de nado, para que el mar abierto
// de la isla y el oasis tranquilo del desierto no compartan mecanicas:
//   superficie(x, z, t)  altura real del agua (con olas en el mar, casi plana en el oasis)
//   contiene(x, z, dentro) si el jugador esta nadando (con histeresis para no parpadear en la orilla)
//   velocidad            m/s al nadar / nadar rapido
//   flotacion            cuanto queda el origen del cuerpo bajo la superficie (el nadador va tendido)
import * as THREE from 'three';

// olas del mar abierto: tambien las usa la malla del mar para que coincidan con el nadador
export const olaMar = (x, z, t) =>
  Math.sin(x * 0.12 + t * 0.9) * 0.12 + Math.cos(z * 0.1 + t * 0.7) * 0.1;

const NIVEL_AGUA = -0.05;

export function crearAgua(tipo, altura) {
  const enAgua = (x, z, dentro) => altura(x, z) < (dentro ? -0.15 : -0.45);
  if (tipo === "mar") {
    return {
      tipo, nivel: NIVEL_AGUA, velocidad: { nadar: 2.4, rapido: 3.4 }, flotacion: 0.32,
      superficie: (x, z, t) => NIVEL_AGUA + olaMar(x, z, t),
      contiene: enAgua
    };
  }
  // oasis: estanque calmado, se nada mas despacio y la superficie casi no se mueve
  return {
    tipo, nivel: NIVEL_AGUA, velocidad: { nadar: 1.9, rapido: 2.7 }, flotacion: 0.32,
    superficie: (x, z, t) => NIVEL_AGUA + 0.015 * Math.sin(t * 1.6 + x * 0.6 + z * 0.4),
    contiene: enAgua
  };
}

// malla del estanque del oasis (plana, con su propio material)
export function crearEstanque(color, radio) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radio, 48), new THREE.MeshStandardMaterial({
    color, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = NIVEL_AGUA;
  m.receiveShadow = true;
  return m;
}
