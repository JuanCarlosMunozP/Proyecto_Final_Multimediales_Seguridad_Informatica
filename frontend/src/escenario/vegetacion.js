// Vegetacion y detalles del suelo segun el bioma: palmeras y cocos, pinos, cactus y pasto.
import * as THREE from 'three';
import { altura, OASIS } from './terreno.js';

// Coloca todo en la escena y registra los troncos en `obstaculos` para las colisiones.
export async function crearVegetacion({ scene, gltfLoader, tema, rnd, obstaculos, fogata, matMadera, sombra }) {
  // ====== PALMERAS (modelo hecho en Blender)
  const palmera = (await gltfLoader.loadAsync("/models/palmera.glb?v=" + Date.now())).scene;
  // Palmeras, pinos y cactus son InstancedMesh: todos los de un tipo comparten geometria y material,
  // asi que cada parte (tronco, hojas, conos...) se dibuja en una sola llamada y no una por arbol.
  // `modelo` = grupo plantilla; `instancias(modelo)` guarda las matrices de cada copia colocada.
  function instancias(modelo) {
    modelo.updateMatrixWorld(true);
    const partes = [];
    modelo.traverse((m) => { if (m.isMesh) partes.push({ malla: m, matrices: [] }); });
    const q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0);
    return {
      partes,
      colocar(x, y, z, escala, giro) {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(eje, giro),
          new THREE.Vector3(escala, escala, escala));
        for (const p of partes) p.matrices.push(m.clone().multiply(p.malla.matrixWorld));
      },
      crear() {
        for (const { malla, matrices } of partes) {
          if (!matrices.length) continue;
          const inst = new THREE.InstancedMesh(malla.geometry, malla.material, matrices.length);
          matrices.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.castShadow = inst.receiveShadow = true;
          scene.add(inst);
        }
      }
    };
  }
  const palmas3d = instancias(palmera);
  const colocarPalmera = palmas3d.colocar;
  let colocadas = 0;
  const palmas = [];
  const maxPalmas = tema.tipo === "isla" ? 32 : 0;
  for (let intento = 0; intento < 200 && colocadas < maxPalmas; intento++) {
    const a = rnd() * Math.PI * 2;
    const d = 14 + rnd() * 22;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = altura(x, z);
    if (y < 0.35) continue;
    if (Math.hypot(x - fogata.x, z - fogata.z) < 4) continue;
    if (Math.hypot(x - tema.spawn.x, z - tema.spawn.z) < 7) continue; // zona de inicio despejada
    const s = 0.85 + rnd() * 0.5;
    colocarPalmera(x, y - 0.1, z, s, rnd() * Math.PI * 2);
    obstaculos.push({ x, z, r: 0.35 * s });
    palmas.push([x, z]);
    colocadas++;
  }

  // ---- montaña: pinos de conos; desierto: palmeras del oasis y cactus
  const matPino = new THREE.MeshStandardMaterial({ color: 0x2c5a38, roughness: 0.9, flatShading: true });
  const matCactus = new THREE.MeshStandardMaterial({ color: 0x4f8a45, roughness: 0.8 });
  const pinoModelo = new THREE.Group();
  {
    const g = pinoModelo;
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6), matMadera);
    tronco.position.y = 0.6;
    g.add(tronco);
    for (let i = 0; i < 3; i++) {
      const cono = new THREE.Mesh(new THREE.ConeGeometry(1.25 - i * 0.3, 1.7, 7), matPino);
      cono.position.y = 1.5 + i * 0.95;
      g.add(cono);
    }
  }
  const pinos = instancias(pinoModelo);
  function crearPino(x, z, esc) {
    pinos.colocar(x, altura(x, z) - 0.05, z, esc, 0);
    obstaculos.push({ x, z, r: 0.4 * esc });
  }
  const cactusModelo = new THREE.Group();
  {
    const g = cactusModelo;
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.2, 10), matCactus);
    cuerpo.position.y = 1.1;
    g.add(cuerpo);
    [[-1, 1.0], [1, 1.25]].forEach(([lado, alto]) => {       // dos brazos a distinta altura
      const horiz = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 8), matCactus);
      horiz.rotation.z = Math.PI / 2;
      horiz.position.set(lado * 0.42, alto, 0);
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.7, 8), matCactus);
      vert.position.set(lado * 0.68, alto + 0.3, 0);
      g.add(horiz, vert);
    });
  }
  const cactus = instancias(cactusModelo);
  function crearCactus(x, z, esc) {
    cactus.colocar(x, altura(x, z) - 0.05, z, esc, rnd() * 6);
    obstaculos.push({ x, z, r: 0.45 * esc });
  }
  if (tema.tipo === "montana") {
    for (let intento = 0; intento < 400 && colocadas < 70; intento++) {
      const a = rnd() * Math.PI * 2, d = 16 + rnd() * 40;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const y = altura(x, z);
      if (y > 8 || y < 0.5) continue;                 // sin pinos en la cima nevada
      if (Math.hypot(x - fogata.x, z - fogata.z) < 4) continue;
      if (Math.hypot(x - tema.spawn.x, z - tema.spawn.z) < 7) continue;
      crearPino(x, z, 0.9 + rnd() * 0.7);
      colocadas++;
    }
  } else if (tema.tipo === "desierto") {
    for (let i = 0; i < 8; i++) {                     // palmeras alrededor del oasis
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.4, d = 9.5 + rnd() * 1.5;
      const x = OASIS.x + Math.cos(a) * d, z = OASIS.z + Math.sin(a) * d;
      if (altura(x, z) < 0.35) continue;
      const esc = 0.9 + rnd() * 0.4;
      colocarPalmera(x, altura(x, z) - 0.1, z, esc, rnd() * Math.PI * 2);
      obstaculos.push({ x, z, r: 0.35 * esc });
      palmas.push([x, z]);
    }
    for (let intento = 0, n = 0; intento < 300 && n < 26; intento++) {
      const a = rnd() * Math.PI * 2, d = 14 + rnd() * 40;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (altura(x, z) < 0.5) continue;
      if (Math.hypot(x - OASIS.x, z - OASIS.z) < 12) continue;
      if (Math.hypot(x - fogata.x, z - fogata.z) < 4) continue;
      if (Math.hypot(x - tema.spawn.x, z - tema.spawn.z) < 7) continue;
      crearCactus(x, z, 0.8 + rnd() * 0.7);
      n++;
    }
  }

  palmas3d.crear();
  pinos.crear();
  cactus.crear();

  // ====== COCOS TIRADOS bajo las palmeras (InstancedMesh: una sola llamada de dibujo)
  {
    const gCoco = new THREE.SphereGeometry(0.16, 12, 10);
    gCoco.scale(1, 0.88, 1.12);
    const coco = new THREE.InstancedMesh(gCoco,
      new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 }), palmas.length * 4);
    coco.castShadow = coco.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let k = 0;
    for (const [px, pz] of palmas) {
      const n = 1 + Math.floor(rnd() * 4);          // 1 a 4 cocos por palmera
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = 0.7 + rnd() * 1.8;
        const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
        const y = altura(x, z);
        if (y < 0.3) continue;                       // no caen al agua
        const s = 0.8 + rnd() * 0.45;
        q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6));
        m.compose(new THREE.Vector3(x, y + 0.12 * s, z), q, new THREE.Vector3(s, s, s));
        coco.setMatrixAt(k++, m);
      }
    }
    coco.count = k;
    scene.add(coco);
  }

  // ====== PASTO (instancias)
  {
    const gHoja = new THREE.ConeGeometry(0.035, 0.34, 3);
    gHoja.translate(0, 0.17, 0);
    const n = tema.hierbaN;
    const pasto = new THREE.InstancedMesh(
      gHoja, new THREE.MeshStandardMaterial({ roughness: 1 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * 36;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const y = altura(x, z);
      if (y < 0.65 || (d < 12 && d > 5)) continue; // sin pasto en las ruinas
      e.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
      q.setFromEuler(e);
      const s = 0.6 + rnd() * 0.9;
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      pasto.setMatrixAt(k, m);
      pasto.setColorAt(k, col.setHSL(tema.hierba[0] + rnd() * 0.06, tema.hierba[1], tema.hierba[2] + rnd() * 0.14));
      k++;
    }
    pasto.count = k;
    scene.add(pasto);
  }
}
