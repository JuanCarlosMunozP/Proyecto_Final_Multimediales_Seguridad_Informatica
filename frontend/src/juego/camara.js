// Camara en tercera persona: orbita con el raton, se suaviza, no atraviesa el terreno ni los
// obstaculos, tiembla al golpear y gira sola alrededor de Max en el menu y en la escena final.
// Tambien lleva la luz calida de relleno que ilumina el rostro cerca del fuego.
import * as THREE from 'three';
import { dispositivo } from '../interfaz/dispositivo.js';

const DIST_CAMARA = 5.6;

// ctx = { estado, jugador, mundo, axel, tiempo } (lo entrega main.js en cada cuadro)
export function crearVista(scene, camera) {
  const reducirMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;   // sin temblor de camara
  const vista = { yaw: 0, pitch: 0.32, sacudida: 0 };   // yaw/pitch: giro e inclinacion; sacudida: temblor

  const objetivoCam = new THREE.Vector3();
  const deseada = new THREE.Vector3();

  // Luz de relleno calida para el rostro: al acercarse a una fogata o antorcha, la cara de Max
  // recibe luz desde la direccion de la llama (los fuegos lejanos casi no la alcanzan).
  const luzRostro = new THREE.PointLight(0xff9a55, 0, 3.2, 2);
  scene.add(luzRostro);
  const _cabeza = new THREE.Vector3();
  const _haciaFuego = new THREE.Vector3();

  vista.iluminarRostro = (dt, { jugador, mundo, axel }) => {
    if (!axel || !dispositivo.luzRostro) return;   // Raspberry: una luz dinamica menos

    _cabeza.set(jugador.pos.x, jugador.pos.y + 1.65, jugador.pos.z);
    let cerca = null, dmin = Infinity;
    for (const f of mundo.fuegos) {
      const d = f.grupo.position.distanceTo(_cabeza);
      if (d < dmin) { dmin = d; cerca = f; }
    }
    let objetivo = 0;
    if (cerca) {
      objetivo = 2.6 * THREE.MathUtils.smoothstep(1 - dmin / 9, 0, 1) * (cerca.luz.intensity / cerca.base);
      _haciaFuego.subVectors(cerca.grupo.position, _cabeza).normalize();
      luzRostro.position.copy(_cabeza).addScaledVector(_haciaFuego, 0.8);
    }
    luzRostro.intensity += (objetivo - luzRostro.intensity) * Math.min(1, dt * 6);
  };

  vista.actualizar = (dt, { estado, jugador, mundo, tiempo }) => {
    const enCasa = estado === "victoria";
    const orbitando = estado === "inicio" || estado === "cargando" || enCasa;
    if (orbitando) {
      // pantalla de inicio: la camara gira alrededor de Max
      vista.yaw = tiempo * 0.25 + 0.6;
      vista.pitch = enCasa ? 0.28 : 0.12;
    }
    const { yaw, pitch } = vista;

    const distancia = enCasa ? 3.3 : orbitando ? 3.4 : DIST_CAMARA;
    objetivoCam.set(jugador.pos.x, jugador.pos.y + (enCasa ? 0.5 : orbitando ? 1.05 : 1.55), jugador.pos.z);
    deseada.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    ).multiplyScalar(distancia).add(objetivoCam);

    // la camara no atraviesa arboles, rocas ni pilares
    for (const o of mundo.obstaculos) {
      const dx = deseada.x - o.x, dz = deseada.z - o.z;
      const min = o.r + 0.5;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        deseada.x = o.x + (dx / d) * min;
        deseada.z = o.z + (dz / d) * min;
      }
    }

    // la camara no atraviesa el terreno
    const minimo = enCasa ? 0.5 : Math.max(mundo.altura(deseada.x, deseada.z), 0) + 0.5;
    deseada.y = Math.max(deseada.y, enCasa ? Math.max(minimo, 1.0) : minimo);

    const suave = orbitando ? 1 : 1 - Math.exp(-dt * 12);
    camera.position.lerp(deseada, suave);

    if (orbitando) {
      // en el menu Max queda a la derecha, lejos del texto
      objetivoCam.x -= Math.cos(yaw) * 0.9;
      objetivoCam.z += Math.sin(yaw) * 0.9;
    }

    // sacudida al recibir o dar golpes
    if (vista.sacudida > 0) {
      camera.position.x += reducirMovimiento ? 0 : (Math.random() - 0.5) * vista.sacudida;
      camera.position.y += reducirMovimiento ? 0 : (Math.random() - 0.5) * vista.sacudida;
      vista.sacudida = Math.max(0, vista.sacudida - dt * 0.8);
    }
    camera.lookAt(objetivoCam);
  };

  return vista;
}
