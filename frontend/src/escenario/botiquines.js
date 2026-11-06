// Modelos de los suministros: el botiquin (caja blanca con cruz roja) y el kit de arma (caja verde
// militar con franja amarilla). No tienen posicion fija: juego/suministros.js los hace aparecer
// al azar por el mapa cada cierto tiempo.
import * as THREE from 'three';

const blanco = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.55 });
const rojo = new THREE.MeshBasicMaterial({ color: 0xd62828, toneMapped: false });
const verde = new THREE.MeshStandardMaterial({ color: 0x4b5a2f, roughness: 0.7 });
const amarillo = new THREE.MeshBasicMaterial({ color: 0xf2c230, toneMapped: false });
const oscuro = new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.5, metalness: 0.6 });

// Las geometrias se comparten entre todos los suministros: cada botiquin o kit que aparece (dos cada
// 10 s) creaba geometrias nuevas que nunca se liberaban, y la memoria de video crecia sin parar.
const geometrias = new Map();
function geometriaCaja(w, h, d) {
  const clave = `${w}|${h}|${d}`;
  if (!geometrias.has(clave)) geometrias.set(clave, new THREE.BoxGeometry(w, h, d));
  return geometrias.get(clave);
}

function caja(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometriaCaja(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function crearModeloBotiquin() {
  const g = new THREE.Group();
  const cruzV = caja(0.1, 0.28, 0.02, rojo, 0, 0, 0.205);
  const cruzH = caja(0.28, 0.1, 0.02, rojo, 0, 0, 0.205);
  g.add(caja(0.62, 0.42, 0.4, blanco), caja(0.24, 0.06, 0.08, blanco, 0, 0.24, 0), cruzV, cruzH,
    cruzV.clone().translateZ(-0.41), cruzH.clone().translateZ(-0.41));      // cruz en las dos caras
  g.traverse((m) => { m.castShadow = true; });
  return g;
}

export function crearModeloKitArma() {
  const g = new THREE.Group();
  g.add(caja(0.7, 0.34, 0.4, verde), caja(0.24, 0.06, 0.08, oscuro, 0, 0.2, 0),
    caja(0.72, 0.06, 0.42, amarillo, 0, 0.05, 0), caja(0.1, 0.1, 0.02, oscuro, 0, -0.05, 0.205));
  g.traverse((m) => { m.castShadow = true; });
  return g;
}
