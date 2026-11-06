// Ataques de Max: golpes cuerpo a cuerpo (puños o el arma que lleve) y disparos de pistola.
import * as THREE from 'three';
import { decir } from '../interfaz/hud.js';

const ALCANCE_PUNOS = 2.2;
const ALCANCE_PISTOLA = 18;

function danarEnemigo(e, dx, dz, dano, { jugador, sonido, vista, obj }) {
  const murio = e.recibirGolpe(dx, dz, dano);
  sonido.impacto();
  vista.sacudida = 0.12;
  if (murio) {
    obj.derrotados++;
    sonido.enemigoCae();
    decir("¡Mercenario derrotado!", 2);
  }
}

// ctx = { axel, jugador, enemigos, sonido, vista, obj } (lo entrega main.js)
// Busca a los mercenarios que quedan frente a Max; el arma da mas alcance y mas daño que los puños.
export function resolverGolpe(ctx) {
  const { axel, jugador, enemigos } = ctx;
  const arma = jugador.arma;
  const alcance = arma ? arma.alcance + 0.65 : ALCANCE_PUNOS;
  const dano = arma?.golpeEnemigo ?? 1;
  const fx = Math.sin(axel.direccion), fz = Math.cos(axel.direccion);   // hacia donde mira Max
  for (const e of enemigos) {
    if (!e.vivo) continue;
    const dx = e.pos.x - jugador.pos.x, dz = e.pos.z - jugador.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < alcance && (dx * fx + dz * fz) / (d || 1) > 0.2) danarEnemigo(e, dx / d, dz / d, dano, ctx);
  }
}

// Disparo de Max: apunta hacia donde mira la camara y le pega al mercenario mas cercano que quede
// sobre esa linea (a menos de 0.7 m de ella). Gasta una bala; sin balas suelta la pistola.
export function dispararJugador(ctx) {
  const { axel, jugador, enemigos, sonido, vista, scene } = ctx;
  axel.direccion = vista.yaw + Math.PI;
  const fx = Math.sin(axel.direccion), fz = Math.cos(axel.direccion);
  jugador.municion--;
  sonido.disparo();
  vista.sacudida = 0.08;

  let blanco = null, mejor = ALCANCE_PISTOLA;
  for (const e of enemigos) {
    if (!e.vivo) continue;
    const dx = e.pos.x - jugador.pos.x, dz = e.pos.z - jugador.pos.z;
    const largo = dx * fx + dz * fz;                    // distancia a lo largo de la linea de tiro
    const lateral = Math.abs(dx * fz - dz * fx);        // cuanto se aparta de la linea
    if (largo > 0 && largo < mejor && lateral < 0.7) { blanco = e; mejor = largo; }
  }

  // fogonazo y trazo de la bala (se borran en unas decimas de segundo)
  const fogonazo = axel.armaMalla?.userData.fogonazo;
  if (fogonazo) { fogonazo.visible = true; setTimeout(() => (fogonazo.visible = false), 70); }
  const origen = new THREE.Vector3(jugador.pos.x + fx * 0.6, jugador.pos.y + 1.35, jugador.pos.z + fz * 0.6);
  const fin = origen.clone().add(new THREE.Vector3(fx, 0, fz).multiplyScalar(mejor));
  const traza = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origen, fin]),
    new THREE.LineBasicMaterial({ color: 0xffe08a, toneMapped: false }));
  scene.add(traza);
  setTimeout(() => { scene.remove(traza); traza.geometry.dispose(); }, 60);

  if (blanco) {
    const dx = blanco.pos.x - jugador.pos.x, dz = blanco.pos.z - jugador.pos.z, d = Math.hypot(dx, dz);
    danarEnemigo(blanco, dx / d, dz / d, jugador.arma.golpeEnemigo, ctx);
  }
}
