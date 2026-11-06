// Nevada de la montaña: copos (THREE.Points) que caen alrededor del jugador y se reciclan al
// salir de la caja que lo rodea, asi basta una cantidad pequeña de particulas para cubrir todo el mapa.
import * as THREE from 'three';
import { textura } from './utilidades.js';
import { dispositivo } from '../interfaz/dispositivo.js';

const COPOS = dispositivo.copos;
const ANCHO = 46;      // lado de la caja de nieve alrededor del jugador (m)
const ALTO = 28;       // altura de la caja (m)
const VIENTO = 1.1;    // deriva horizontal constante (m/s)

export function crearNieve(scene) {
  const posiciones = new Float32Array(COPOS * 3);
  const caida = new Float32Array(COPOS);     // m/s
  const fase = new Float32Array(COPOS);      // balanceo propio de cada copo
  for (let i = 0; i < COPOS; i++) {
    posiciones.set([(Math.random() - 0.5) * ANCHO, Math.random() * ALTO, (Math.random() - 0.5) * ANCHO], i * 3);
    caida[i] = 1.1 + Math.random() * 1.4;
    fase[i] = Math.random() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));

  const copo = textura(32, (ctx, t) => {
    const g = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, t, t);
  });
  const nieve = new THREE.Points(geo, new THREE.PointsMaterial({
    map: copo, size: 0.2, transparent: true, opacity: 0.92, depthWrite: false
  }));
  nieve.frustumCulled = false;     // los copos se mueven con el jugador
  scene.add(nieve);

  let inicializada = false;
  function actualizar(t, dt, centro) {
    const p = geo.attributes.position;
    const a = p.array;
    if (!inicializada) {                       // primera vez: llenar la caja alrededor del jugador
      for (let i = 0; i < COPOS; i++) {
        a[i * 3] += centro.x;
        a[i * 3 + 1] += centro.y - 3;
        a[i * 3 + 2] += centro.z;
      }
      inicializada = true;
    }
    for (let i = 0; i < COPOS; i++) {
      const k = i * 3;
      a[k] += (Math.sin(t * 0.8 + fase[i]) * 0.5 + VIENTO) * dt;
      a[k + 1] -= caida[i] * dt;
      a[k + 2] += Math.cos(t * 0.6 + fase[i]) * 0.4 * dt;
      // reciclar los copos que salen de la caja que rodea al jugador
      const dx = a[k] - centro.x, dz = a[k + 2] - centro.z, dy = a[k + 1] - (centro.y - 3);
      if (dx > ANCHO / 2) a[k] -= ANCHO; else if (dx < -ANCHO / 2) a[k] += ANCHO;
      if (dz > ANCHO / 2) a[k + 2] -= ANCHO; else if (dz < -ANCHO / 2) a[k + 2] += ANCHO;
      if (dy < 0) a[k + 1] += ALTO; else if (dy > ALTO) a[k + 1] -= ALTO;
    }
    p.needsUpdate = true;
  }

  return { actualizar };
}
