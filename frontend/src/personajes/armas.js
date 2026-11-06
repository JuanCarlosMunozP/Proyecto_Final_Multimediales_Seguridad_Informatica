// Armas de los mercenarios. Cada partida reparte armas al azar (Math.random, sin semilla), asi que
// los mismos mercenarios no llevan lo mismo dos veces.
//   tipo "cuerpo": ataque cuerpo a cuerpo con `alcance` (m)
//   tipo "pistola": dispara balas desde `distancia` (m) hasta `rango` (m)
//   dano = vida que quita a Max | golpeEnemigo = vida que quita a un mercenario (tiene 3) cuando Max la usa | espera = segundos entre ataques
import * as THREE from 'three';

const metal = () => new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.4, metalness: 0.7 });
const acero = () => new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.9 });
const madera = () => new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
const cuero = () => new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.9 });

// Las armas se construyen apuntando hacia +Y (la direccion de los dedos) con el agarre en el origen.
const caja = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

function crearPistola() {
  const g = new THREE.Group();
  g.add(caja(0.034, 0.21, 0.042, metal(), 0, 0.09, 0.0));          // corredera
  g.add(caja(0.03, 0.05, 0.1, metal(), 0, 0.005, -0.06));           // empuñadura
  g.add(caja(0.012, 0.045, 0.012, metal(), 0, 0.04, -0.03));        // gatillo
  const fogonazo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({
    color: 0xffd36a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false
  }));
  fogonazo.position.y = 0.22;
  fogonazo.visible = false;
  g.add(fogonazo);
  g.userData.fogonazo = fogonazo;
  return g;
}

function crearCuchillo() {
  const g = new THREE.Group();
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 8), cuero());
  g.add(mango, caja(0.012, 0.19, 0.036, acero(), 0, 0.15, 0), caja(0.05, 0.012, 0.02, metal(), 0, 0.058, 0));
  return g;
}

function crearBate() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.85, 10), madera());
  cuerpo.position.y = 0.3;
  g.add(cuerpo);
  return g;
}

function crearMachete() {
  const g = new THREE.Group();
  const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.13, 8), cuero());
  g.add(mango, caja(0.012, 0.5, 0.075, acero(), 0, 0.37, 0), caja(0.055, 0.014, 0.025, metal(), 0, 0.068, 0));
  return g;
}

export const ARMAS = {
  // dano segun el arma: puños muy poco, cuchillo/machete/bate algo mas (la pistola depende de donde pega)
  puños: { id: "puños", tipo: "cuerpo", alcance: 1.55, dano: 4, golpeEnemigo: 1, espera: 1.3, peso: 0.2, crear: null },
  cuchillo: { id: "cuchillo", tipo: "cuerpo", alcance: 1.75, dano: 10, golpeEnemigo: 1.5, espera: 0.8, peso: 0.2, crear: crearCuchillo },
  bate: { id: "bate", tipo: "cuerpo", alcance: 2.1, dano: 14, golpeEnemigo: 2.5, espera: 1.8, peso: 0.15, crear: crearBate },
  machete: { id: "machete", tipo: "cuerpo", alcance: 1.9, dano: 13, golpeEnemigo: 2, espera: 1.3, peso: 0.15, crear: crearMachete },
  pistola: {
    id: "pistola", tipo: "pistola", alcance: 1.55, dano: 10, golpeEnemigo: 1.5, espera: 1.7, peso: 0.3, crear: crearPistola,
    distancia: 7, rango: 14, largoCanon: 0.22
  }
};

// Dano de un balazo segun la altura donde pega (y = metros sobre los pies de Max, que mide ~1.8):
// cabeza y pecho/corazon matan al instante; abdomen y piernas solo hieren.
// `lateral` = metros hacia la izquierda de Max (negativo = derecha) donde pega: si cae lejos del
// eje del cuerpo le da en un brazo (hiere, no mata). `herida` dice que animacion de dolor usar.
export function zonaDeBala(y, lateral = 0) {
  const lado = lateral >= 0 ? "I" : "D";
  const brazo = Math.abs(lateral) > 0.2;
  if (y > 1.55) return { zona: "la cabeza", mortal: true };
  if (y > 0.8 && brazo) return { zona: "el brazo", dano: 10, herida: { parte: "brazo", lado } };
  if (y > 1.15) return { zona: "el pecho", mortal: true };
  if (y > 0.8) return { zona: "el abdomen", dano: 20, herida: { parte: "abdomen", lado } };
  if (y > 0.35 && y < 0.6) return { zona: "la rodilla", dano: 10, herida: { parte: "rodilla", lado } };
  return { zona: "la pierna", dano: 10, herida: { parte: "pierna", lado } };
}

// sorteo con pesos: cada llamada puede dar un arma distinta
export function armaAleatoria() {
  let r = Math.random();
  for (const a of Object.values(ARMAS)) {
    r -= a.peso;
    if (r <= 0) return a;
  }
  return ARMAS.puños;
}

// Coloca el arma en la mano derecha del humano, alineada con los dedos (el hueso de la mano
// cambia segun la pose, asi que el arma sigue al antebrazo). Devuelve la malla o null.
export function equiparArma(humano, arma) {
  humano.armaMalla?.removeFromParent();       // suelta la que llevaba
  humano.armaMalla = null;
  if (!arma.crear) return null;
  const mano = humano.cuerpo.getObjectByName("mixamorig1RightHand");
  const dedo = humano.cuerpo.getObjectByName("mixamorig1RightHandMiddle1");
  if (!mano || !dedo) return null;
  const malla = arma.crear();
  malla.traverse((m) => { m.castShadow = true; });
  const direccion = dedo.position.clone().normalize();
  malla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direccion);
  malla.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(direccion, arma.giro ?? 0));
  malla.scale.setScalar(1 / mano.getWorldScale(new THREE.Vector3()).x);   // el hueso puede venir escalado
  malla.position.copy(dedo.position).multiplyScalar(0.55);
  mano.add(malla);
  humano.armaMalla = malla;
  return malla;
}

// armas que Max puede encontrar en los kits (todas menos los puños)
export function armaDeKit() {
  const lista = Object.values(ARMAS).filter((a) => a.crear);
  return lista[Math.floor(Math.random() * lista.length)];
}
