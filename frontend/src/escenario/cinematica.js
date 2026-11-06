// Cinematica corta del dialogo con Daniel: el avion de Max cae al mar a unos 10 km de la isla y su
// cuerpo inconsciente queda flotando entre los restos (la siguiente, en cinematicaPlaya.js, lo
// muestra varado en la playa). Se arma con figuras basicas de Three.js (avion de cajas y cilindros),
// humo y salpicaduras con THREE.Points, y la camara sigue la accion.
// Ocurre lejos de la isla (ORIGEN) para no mezclarse con el nivel; el cielo sigue a la camara.
import * as THREE from 'three';
import { fundido } from '../interfaz/hud.js';
import { textura } from './utilidades.js';
import { ORIGEN, crearParticulas, interfazCine, suavizar } from './cineUtil.js';

const DURACION = 24;          // segundos
const T_IMPACTO = 8.5;        // el avion toca el agua
const SUBTITULOS = [
  [0, "Hace una semana, a unos 10 km de esta isla, mi avión perdió el control…"],
  [8.4, "…y se estrelló en pleno mar."],
  [14, "Salí despedido del avión y quedé flotando, inconsciente, entre los restos…"]
];

function crearAvion() {
  const blanco = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  const rojo = new THREE.MeshStandardMaterial({ color: 0xb0302a, roughness: 0.6 });
  const g = new THREE.Group();                       // el avion vuela hacia +X
  const fuselaje = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 5, 12), blanco);
  fuselaje.rotation.z = Math.PI / 2;
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 12), rojo);
  nariz.rotation.z = -Math.PI / 2;
  nariz.position.x = 2.95;
  const alas = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 7.4), blanco);
  alas.position.set(0.3, 0, 0);
  const timon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.08), rojo);
  timon.position.set(-2.3, 0.75, 0);
  const cola = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.2), blanco);
  cola.position.set(-2.3, 0.1, 0);
  g.add(fuselaje, nariz, alas, timon, cola);
  g.helices = [];
  for (const z of [-1.8, 1.8]) {                     // dos helices que giran
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    h.position.set(0.95, 0, z);
    g.add(h);
    g.helices.push(h);
  }
  g.traverse((m) => { m.castShadow = true; });
  return g;
}

export function crearCinematicaAvion({ scene, camera, sonido, crearMax }) {
  const g = new THREE.Group();
  g.position.copy(ORIGEN);
  scene.add(g);

  const mar = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x1c6a86, roughness: 0.2, metalness: 0.15 }));
  mar.rotation.x = -Math.PI / 2;
  g.add(mar);
  const avion = crearAvion();
  g.add(avion);
  const fuego = new THREE.PointLight(0xff8a3c, 20, 14, 2);
  avion.add(fuego);

  const circulo = textura(32, (ctx, t) => {
    const r = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, t, t);
  });
  const humo = crearParticulas(140, new THREE.PointsMaterial({
    map: circulo, size: 1.6, color: 0x2a2a2a, transparent: true, opacity: 0.75, depthWrite: false
  }));
  const espuma = crearParticulas(90, new THREE.PointsMaterial({
    map: circulo, size: 0.9, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false
  }));
  g.add(humo.puntos, espuma.puntos);

  // restos flotando (un trozo de ala y un asiento)
  const restos = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4 - i * 0.4, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: i === 1 ? 0xb0302a : 0xe8e8e8 }));
    m.visible = false;
    g.add(m);
    return m;
  });

  // Max inconsciente: sale despedido del avion al chocar y flota boca arriba entre los restos
  const max = crearMax();
  max.grupo.visible = false;
  g.add(max.grupo);
  const salida = new THREE.Vector3();                // de donde salta al chocar

  const ui = interfazCine(SUBTITULOS);
  let t = 0, humoT = 0, impacto = false;

  function emitir(sis, x, y, z, vx, vy, vz) {
    const k = sis.i * 3;
    sis.pos.set([x, y, z], k);
    sis.vel.set([vx, vy, vz], k);
    sis.i = (sis.i + 1) % sis.n;
  }
  function mover(sis, dt, gravedad) {
    for (let i = 0; i < sis.n * 3; i += 3) {
      if (sis.pos[i + 1] < -9000) continue;
      sis.vel[i + 1] += gravedad * dt;
      sis.pos[i] += sis.vel[i] * dt;
      sis.pos[i + 1] += sis.vel[i + 1] * dt;
      sis.pos[i + 2] += sis.vel[i + 2] * dt;
      if (gravedad < 0 && sis.pos[i + 1] < 0) sis.pos[i + 1] = -9999;   // la espuma cae al agua
    }
    sis.puntos.geometry.attributes.position.needsUpdate = true;
  }

  function terminar() {
    scene.remove(g);
    ui.cerrar();
  }

  // devuelve false cuando la cinematica termino (ya limpio)
  function actualizar(dt) {
    t += dt;
    if (ui.saltar || t >= DURACION) { terminar(); return false; }

    // ---- avion: baja en picada hacia el mar, toca el agua y se hunde despacio
    if (t < T_IMPACTO) {
      const s = t / T_IMPACTO;
      avion.position.set(-85 + 85 * s, 0.5 + 34 * Math.pow(1 - s, 1.8), 0);
      avion.rotation.z = Math.atan2(-34 * 1.8 * Math.pow(1 - s, 0.8), 85) * 0.9;
      avion.rotation.x = Math.sin(t * 5) * 0.12;
    } else {
      const d = t - T_IMPACTO;
      avion.position.set(6 * (1 - Math.exp(-d * 1.2)), Math.max(-2.2, 0.5 - 0.4 * d), 0);
      avion.rotation.z = 0.2 + Math.sin(d * 2) * 0.05;
      if (!impacto) {                                        // salpicadura y sonido al tocar el agua
        impacto = true;
        sonido.impacto();
        for (let i = 0; i < espuma.n; i++) {
          emitir(espuma, avion.position.x, 0.2, (Math.random() - 0.5) * 3,
            2 + Math.random() * 5, 5 + Math.random() * 8, (Math.random() - 0.5) * 7);
        }
        restos.forEach((m, i) => { m.visible = true; m.position.set(2 + i * 2, 0, (i - 1) * 2.2); });
        salida.copy(avion.position);
        max.grupo.visible = true;
      }
    }
    for (const h of avion.helices) h.rotation.x += dt * (t < T_IMPACTO ? 40 : 6);
    fuego.intensity = t < T_IMPACTO + 1.5 ? 16 + Math.random() * 10 : 0;
    restos.forEach((m, i) => {
      m.position.x += dt * (0.3 + i * 0.15);
      m.position.y = Math.sin(t * 1.7 + i) * 0.1;
      m.rotation.y += dt * 0.2;
    });

    // ---- humo de la cola
    humoT -= dt;
    if (humoT <= 0 && t < T_IMPACTO + 1.5) {
      humoT = 0.03;
      const c = avion.position;
      emitir(humo, c.x - 2.6, c.y + 0.2, 0, -1.5 + Math.random(), 0.6 + Math.random(), (Math.random() - 0.5));
    }
    mover(humo, dt, 0.4);
    mover(espuma, dt, -14);

    // ---- Max: un salto corto hasta el agua y luego flota con las olas, lentamente a la deriva
    if (impacto) {
      const d = t - T_IMPACTO, caida = Math.min(d / 1.1, 1);
      const x = salida.x + 4.5 * caida + Math.max(0, d - 1.1) * 0.25;
      const z = 2.6 * caida;
      const y = caida < 1 ? salida.y + 0.8 + 3.2 * caida - 4.6 * caida * caida : -0.1 + Math.sin(t * 1.3) * 0.05;
      max.grupo.position.set(x, Math.max(y, -0.1), z);
      max.grupo.rotation.y = -Math.PI / 2 + 0.5;       // cuerpo casi paralelo a las olas
      max.cuerpo.rotation.z = 0.12;
      max.actualizar(dt, 0, true, t, 0, false, "oculto");
    }

    // ---- camara: sigue al avion, y al final se acerca al cuerpo que flota
    const p = avion.position;
    let cx, cy, cz;
    if (t < T_IMPACTO) {
      cx = ORIGEN.x - 8 + p.x * 0.15; cy = ORIGEN.y + 6 + p.y * 0.2; cz = ORIGEN.z + 32;
    } else {
      cx = ORIGEN.x - 6 + (t - T_IMPACTO) * 0.8; cy = ORIGEN.y + 5 + (t - T_IMPACTO) * 0.6; cz = ORIGEN.z + 30;
    }
    let mx = ORIGEN.x + p.x * 0.9, my = ORIGEN.y + Math.max(p.y * 0.7, 1), mz = ORIGEN.z;
    const acerca = suavizar((t - 11.5) / 4.5);       // del plano general al plano medio del cuerpo flotando
    if (acerca > 0) {
      const m = max.grupo.position;
      cx += (ORIGEN.x + m.x + 0.8 - cx) * acerca; cy += (ORIGEN.y + 0.9 - cy) * acerca; cz += (ORIGEN.z + m.z + 3.6 - cz) * acerca;
      mx += (ORIGEN.x + m.x - mx) * acerca; my += (ORIGEN.y + 0.1 - my) * acerca; mz += (ORIGEN.z + m.z - mz) * acerca;
    }
    camera.position.set(cx, cy, cz);
    camera.lookAt(mx, my, mz);

    // ---- subtitulos y fundido final
    ui.texto(t);
    fundido.style.opacity = t > DURACION - 1.2 ? 1 : 0;
    return true;
  }

  return { actualizar };
}
