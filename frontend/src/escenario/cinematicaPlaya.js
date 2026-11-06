// Cinematica de la playa: una semana despues del choque, las corrientes dejaron a Max en la orilla.
// Esta tendido boca arriba, inconsciente y con los ojos cerrados, mientras las olas le suben y le
// bajan por las piernas. La camara se acerca desde un plano general hasta su cara.
// Igual que la del avion, ocurre lejos de la isla (ORIGEN) y se arma con figuras basicas.
import * as THREE from 'three';
import { fundido } from '../interfaz/hud.js';
import { ORIGEN, interfazCine, suavizar } from './cineUtil.js';

const DURACION = 15;          // segundos
const SUBTITULOS = [
  [0.4, "Una semana después…"],
  [4.5, "…las corrientes me arrastraron hasta esta playa."]
];
const Z_MAX = 1.6;            // distancia de Max al agua (la costa esta en z = 0 y la arena sube hacia +z)

// altura de la arena en cada punto: fondo marino plano, y desde z = -7 una pendiente suave hacia la playa
const alturaArena = (z) => -0.9 + 0.13 * Math.max(0, z + 7);

export function crearCinematicaPlaya({ scene, camera, crearMax }) {
  const g = new THREE.Group();
  g.position.copy(ORIGEN);
  scene.add(g);

  // ---- arena con pendiente
  const geoArena = new THREE.PlaneGeometry(120, 60, 1, 60);
  const pos = geoArena.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, alturaArena(-pos.getY(i)));   // tras girar el plano, y -> -z
  geoArena.computeVertexNormals();
  const arena = new THREE.Mesh(geoArena, new THREE.MeshStandardMaterial({ color: 0xd9bf8a, roughness: 1 }));
  arena.rotation.x = -Math.PI / 2;
  arena.receiveShadow = true;
  g.add(arena);

  // ---- mar: el nivel sube y baja y la ola alcanza las piernas de Max
  const mar = new THREE.Mesh(new THREE.PlaneGeometry(200, 120),
    new THREE.MeshStandardMaterial({ color: 0x2a8aa5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  mar.rotation.x = -Math.PI / 2;
  mar.position.z = -30;                               // cubre el fondo; donde la arena sube por encima, el agua queda oculta
  g.add(mar);
  const espuma = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  espuma.rotation.x = -Math.PI / 2;
  g.add(espuma);                                      // linea de espuma que sigue al borde del agua

  // ---- restos del naufragio y una maleta varada
  const blanco = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const ala = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.1), blanco);
  ala.position.set(-4.5, alturaArena(0.3) + 0.04, 0.3);
  ala.rotation.y = 0.5;
  const maleta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.45), new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.8 }));
  maleta.position.set(4.2, alturaArena(3.4) + 0.1, 3.4);
  maleta.rotation.y = -0.4;
  for (const m of [ala, maleta]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(ala, maleta);

  // ---- Max: boca arriba, paralelo a la orilla con la cabeza hacia +x y la cara hacia la camara
  const max = crearMax();
  max.grupo.position.set(0, alturaArena(Z_MAX) - 0.03, Z_MAX);
  max.grupo.rotation.y = -Math.PI / 2;
  max.cuerpo.rotation.z = 0.08;
  g.add(max.grupo);

  const ui = interfazCine(SUBTITULOS);
  let t = 0;
  const cabeza = new THREE.Vector3();

  function terminar() {
    scene.remove(g);
    ui.cerrar();
  }

  // devuelve false cuando la cinematica termino (ya limpio)
  function actualizar(dt) {
    t += dt;
    if (ui.saltar || t >= DURACION) { terminar(); return false; }

    // olas: el nivel oscila despacio; sube hasta cubrir un poco la arena a la altura de las piernas
    const ola = 0.5 + 0.5 * Math.sin(t * 0.6 - 0.8);
    const nivel = -0.06 + 0.4 * ola * ola;
    mar.position.y = nivel;
    const zOrilla = -7 + 0.9 / 0.13 + nivel / 0.13;     // donde la arena iguala al agua: alturaArena(z) = nivel
    espuma.position.set(0, nivel + 0.015, zOrilla + 0.1);

    max.actualizar(dt, 0, true, t, 0, false, "oculto");  // inconsciente: respira lento, ojos cerrados

    // camara: plano general desde el costado y luego un acercamiento lento hasta la cara
    max.j.cabeza.getWorldPosition(cabeza);
    cabeza.sub(ORIGEN);
    const k = suavizar((t - 3.5) / 8);
    const lejos = new THREE.Vector3(-4.2, 1.2, 5.6), cerca = new THREE.Vector3(cabeza.x + 0.3, cabeza.y + 0.45, cabeza.z + 1.15);
    const generalMira = new THREE.Vector3(0, 0.3, Z_MAX - 0.2), caraMira = cabeza.clone().add(new THREE.Vector3(0, -0.02, 0));
    camera.position.copy(lejos.lerp(cerca, k)).add(ORIGEN);
    camera.lookAt(generalMira.lerp(caraMira, k).add(ORIGEN));

    ui.texto(t);
    fundido.style.opacity = t > DURACION - 1.2 ? 1 : 0;
    return true;
  }

  return { actualizar };
}
