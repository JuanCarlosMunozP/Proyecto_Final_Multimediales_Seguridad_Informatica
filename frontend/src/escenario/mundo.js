// Escenario: arma el mundo de un nivel (luces, terreno, agua, ruinas, fogata e idolos) a partir de su tema.
// El cielo, la vegetacion y el portal viven en sus propios modulos de esta carpeta.
import * as THREE from 'three';
import { crearAgua, crearEstanque, olaMar } from './agua.js';
import { TEMAS } from './temas.js';
import { altura, usarBioma, OASIS } from './terreno.js';
import { aleatorio, textura } from './utilidades.js';
import { crearCielo } from './cielo.js';
import { crearVegetacion } from './vegetacion.js';
import { crearPortal } from './portal.js';
import { crearNieve } from './nieve.js';
import { dispositivo } from '../interfaz/dispositivo.js';

export { liberar } from './utilidades.js';

export async function crearMundo(scene, gltfLoader, tema = TEMAS[0]) {
  usarBioma(tema);
  const rnd = aleatorio(tema.semilla);
  const obstaculos = []; // circulos {x, z, r}
  const animables = [];

  const { cielo, estrellas, dirSol } = crearCielo(scene, tema, rnd);

  // ====== LUCES
  const hemisferio = new THREE.HemisphereLight(tema.hemi, 0x2f3d27, 1.1);
  scene.add(hemisferio);

  const sol = new THREE.DirectionalLight(tema.solColor, 3.4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(dispositivo.sombra, dispositivo.sombra);   // 2048 en computador, 512 en Raspberry
  const cs = sol.shadow.camera;
  cs.left = cs.bottom = -32;
  cs.right = cs.top = 32;
  cs.near = 1;
  cs.far = 140;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.04;
  scene.add(sol, sol.target);

  const relleno = new THREE.DirectionalLight(0x6a7fd0, 0.5); // luz fria del cielo
  relleno.position.set(30, 20, 40);
  scene.add(relleno);

  // ====== TERRENO
  const TAM = 130, SEG = dispositivo.segmentosTerreno;
  const gTerreno = new THREE.PlaneGeometry(TAM, TAM, SEG, SEG);
  gTerreno.rotateX(-Math.PI / 2);
  const pos = gTerreno.attributes.position;
  const colores = new Float32Array(pos.count * 3);
  const arena = new THREE.Color(tema.arena);
  const pasto = new THREE.Color(tema.pasto);
  const pastoOscuro = new THREE.Color(tema.pastoOscuro);
  const lecho = new THREE.Color(0x6b5a3a);
  const cimaColor = new THREE.Color(tema.cima ? tema.cima.color : 0xffffff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = altura(x, z);
    pos.setY(i, h);
    const ruido = rnd() * 0.12;
    if (h < -0.4) c.copy(lecho);
    else if (h < 0.55) c.copy(arena).lerp(pasto, THREE.MathUtils.smoothstep(h, 0.25, 0.55));
    else c.copy(pasto).lerp(pastoOscuro, THREE.MathUtils.clamp((h - 1.2) / 1.6, 0, 1));
    if (tema.cima) c.lerp(cimaColor, THREE.MathUtils.smoothstep(h, tema.cima.desde, tema.cima.desde + 3));
    c.offsetHSL(0, 0, ruido - 0.06);
    colores.set([c.r, c.g, c.b], i * 3);
  }
  gTerreno.setAttribute("color", new THREE.BufferAttribute(colores, 3));
  gTerreno.computeVertexNormals();

  const texTierra = textura(256, (ctx, t) => {
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, t, t);
    for (let i = 0; i < 5000; i++) {
      const g = 150 + Math.random() * 105;
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(Math.random() * t, Math.random() * t, 2, 3);
    }
  }, 40);

  const terreno = new THREE.Mesh(gTerreno, new THREE.MeshStandardMaterial({
    vertexColors: true, map: texTierra, roughness: 1
  }));
  terreno.receiveShadow = true;
  scene.add(terreno);

  if (tema.tipo !== "isla") {
    // Suelo lejano hasta el horizonte. Lleva un hueco cuadrado del tamano del terreno (con 1 m de
    // solape): como esta a 0.9 m, un disco completo taparia todo lo que el terreno tenga por
    // debajo, como el estanque del oasis (-2.6 m) y a quien nade en el.
    const forma = new THREE.Shape();
    forma.absarc(0, 0, 600, 0, Math.PI * 2, false);
    const hueco = new THREE.Path();
    const m = TAM / 2 - 1;
    hueco.moveTo(-m, -m); hueco.lineTo(-m, m); hueco.lineTo(m, m); hueco.lineTo(m, -m); hueco.closePath();
    forma.holes.push(hueco);
    const lejano = new THREE.Mesh(new THREE.ShapeGeometry(forma, 32),
      new THREE.MeshStandardMaterial({ color: tema.pasto, roughness: 1 }));
    lejano.rotation.x = -Math.PI / 2;
    lejano.position.y = 0.9;
    lejano.receiveShadow = true;
    scene.add(lejano);
  }

  // ====== AGUA: mar abierto (isla) o estanque del oasis (desierto); la montana no tiene
  const agua = tema.tipo === "isla" ? crearAgua("mar", altura)
    : tema.tipo === "desierto" ? crearAgua("oasis", altura) : null;
  if (agua && agua.tipo === "mar") {
    const gMar = new THREE.PlaneGeometry(700, 700, 64, 64);
    gMar.rotateX(-Math.PI / 2);
    const mar = new THREE.Mesh(gMar, new THREE.MeshStandardMaterial({
      color: tema.mar, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.92
    }));
    mar.position.y = agua.nivel;
    mar.receiveShadow = true;
    scene.add(mar);
    const baseMar = gMar.attributes.position.array.slice();
    animables.push((t) => {
      const p = gMar.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, olaMar(baseMar[i * 3], baseMar[i * 3 + 2], t));
      p.needsUpdate = true;
    });
  } else if (agua) {
    const estanque = crearEstanque(tema.mar, 9.5);
    estanque.position.x = OASIS.x;
    estanque.position.z = OASIS.z;
    scene.add(estanque);
  }

  // ====== TEXTURA DE PIEDRA (ruinas y rocas)
  const texPiedra = textura(256, (ctx, t) => {
    ctx.fillStyle = "#9a9486";
    ctx.fillRect(0, 0, t, t);
    for (let i = 0; i < 2500; i++) {
      const g = 90 + Math.random() * 90;
      ctx.fillStyle = `rgba(${g},${g - 6},${g - 16},0.5)`;
      ctx.fillRect(Math.random() * t, Math.random() * t, 3, 3);
    }
    ctx.strokeStyle = "rgba(40,36,30,0.55)";
    ctx.lineWidth = 2;
    for (let y = 0; y < t; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(t, y); ctx.stroke();
      for (let x = (y / 64 % 2) * 64; x < t; x += 128) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
      }
    }
  }, 1);
  const matPiedra = new THREE.MeshStandardMaterial({ map: texPiedra, roughness: 0.95 });
  const matRoca = new THREE.MeshStandardMaterial({
    color: tema.roca, roughness: 1, flatShading: true
  });
  const matMadera = new THREE.MeshStandardMaterial({ color: 0x4a301a, roughness: 0.9 });

  const sombra = (o, proyecta = true) => {
    o.traverse((m) => {
      if (m.isMesh) { m.castShadow = proyecta; m.receiveShadow = true; }
    });
    return o;
  };

  // ====== TEXTURA DE LLAMA
  const texLlama = textura(64, (ctx, t) => {
    const g = ctx.createRadialGradient(t / 2, t * 0.6, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, "rgba(255,240,170,1)");
    g.addColorStop(0.35, "rgba(255,150,40,0.85)");
    g.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, t, t);
  });

  // ====== HUMO: bocanadas grises y suaves que suben desde la llama, se agrandan y se desvanecen
  const texHumo = textura(64, (ctx, t) => {
    const g = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, t, t);
  });
  const VIDA_HUMO = 3.6;                       // segundos que tarda una bocanada en subir y desaparecer

  const fuegos = [];
  function crearFuego(x, y, z, escala = 1, intensidad = 22) {
    const grupo = new THREE.Group();
    grupo.position.set(x, y, z);
    const llamas = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texLlama, blending: THREE.AdditiveBlending, depthWrite: false,
        transparent: true, fog: false
      }));
      s.position.y = 0.25 * escala;
      s.userData = { fase: rnd() * 6.28, vel: 4 + rnd() * 4 };
      llamas.push(s);
      grupo.add(s);
    }
    const luz = new THREE.PointLight(0xff8a3c, intensidad, 18, 2);
    luz.position.y = 0.7 * escala;
    grupo.add(luz);
    const humo = [];
    for (let i = 0; i < (escala >= 1 ? 9 : 5); i++) {   // las antorchas sacan menos humo que la fogata
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texHumo, color: 0x4f4a45, transparent: true, opacity: 0, depthWrite: false, fog: false
      }));
      humo.push(s);
      grupo.add(s);
    }
    scene.add(grupo);
    fuegos.push({ grupo, llamas, humo, luz, escala, base: intensidad, fase: rnd() * 10 });
  }

  animables.push((t) => {
    for (const f of fuegos) {
      for (const s of f.llamas) {
        const k = 0.8 + Math.sin(t * s.userData.vel + s.userData.fase) * 0.25;
        s.scale.set(0.8 * f.escala * k, 1.4 * f.escala * k, 1);
        s.position.y = (0.3 + Math.sin(t * s.userData.vel * 0.7 + s.userData.fase) * 0.06) * f.escala;
      }
      f.humo.forEach((s, i) => {
        const u = ((t / VIDA_HUMO + i / f.humo.length + f.fase) % 1 + 1) % 1;   // 0 = nace, 1 = se disipa
        const e = f.escala;
        s.position.set(Math.sin(u * 5 + i * 2.1 + f.fase) * 0.18 * e + u * u * 0.9 * e,   // sube ondulando y el viento lo arrastra
          (0.55 + u * 2.4) * e, Math.cos(u * 4 + i * 1.7) * 0.15 * e);
        const tam = (0.45 + u * 1.5) * e;
        s.scale.set(tam, tam, 1);
        s.material.opacity = 0.75 * Math.min(1, u / 0.12) * Math.pow(1 - u, 1.1);
        s.material.rotation = u * 1.5 + i;
      });
      // parpadeo de la luz
      f.luz.intensity = f.base * (0.85 + Math.sin(t * 13 + f.fase) * 0.08 + Math.sin(t * 7.3 + f.fase) * 0.07);
    }
  });

  // ====== FOGATA (aqui se cura el jugador)
  const fogata = { x: 4.5, z: 10.5 };
  {
    const y = altura(fogata.x, fogata.z);
    const g = new THREE.Group();
    g.position.set(fogata.x, y, fogata.z);
    for (let i = 0; i < 6; i++) {
      const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 8), matMadera);
      tronco.rotation.z = Math.PI / 2 - 0.35;
      tronco.rotation.order = "YXZ";
      tronco.rotation.y = (i / 6) * Math.PI * 2;
      tronco.position.y = 0.12;
      g.add(tronco);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const piedra = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), matRoca);
      piedra.position.set(Math.cos(a) * 0.75, 0.08, Math.sin(a) * 0.75);
      piedra.rotation.set(rnd() * 3, rnd() * 3, 0);
      g.add(piedra);
    }
    sombra(g);
    scene.add(g);
    crearFuego(fogata.x, y + 0.1, fogata.z, 1.3, 30);
    obstaculos.push({ x: fogata.x, z: fogata.z, r: 0.9 });
  }

  // ====== RUINAS ANTIGUAS
  const ruinas = new THREE.Group();
  scene.add(ruinas);
  const yMeseta = altura(0, 0);

  function pilar(x, z, alto, rota = false) {
    const g = new THREE.Group();
    const y = altura(x, z);
    g.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), matPiedra);
    base.position.y = 0.2;
    const fuste = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, alto, 14), matPiedra);
    fuste.position.y = 0.4 + alto / 2;
    g.add(base, fuste);
    if (!rota) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), matPiedra);
      cap.position.y = 0.4 + alto + 0.17;
      g.add(cap);
    } else {
      // pedazo caido en el suelo
      const caido = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 2.2, 14), matPiedra);
      caido.rotation.z = Math.PI / 2;
      caido.rotation.y = rnd() * 3;
      caido.position.set(1.2, 0.42, 0.9);
      g.add(caido);
    }
    sombra(g);
    ruinas.add(g);
    obstaculos.push({ x, z, r: 0.75 });
  }

  const nPilares = 10;
  for (let i = 0; i < nPilares; i++) {
    const a = (i / nPilares) * Math.PI * 2 + 0.3;
    const rota = i % 3 === 1;
    pilar(Math.cos(a) * 8.2, Math.sin(a) * 8.2, rota ? 1.8 : 4.4, rota);
  }

  // Arco de entrada al norte
  pilar(-2.6, -13, 5.2);
  pilar(2.6, -13, 5.2);
  {
    const dintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 1.3), matPiedra);
    dintel.position.set(0, altura(0, -13) + 6.0, -13);
    sombra(dintel);
    ruinas.add(dintel);
  }

  // Altar escalonado
  const altar = { x: 0, z: 0 };
  {
    const g = new THREE.Group();
    g.position.set(0, yMeseta, 0);
    const tam = [5.2, 4.0, 2.8];
    tam.forEach((t, i) => {
      const escalon = new THREE.Mesh(new THREE.BoxGeometry(t, 0.35, t), matPiedra);
      escalon.position.y = 0.175 + i * 0.35;
      g.add(escalon);
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.0, 16), matPiedra);
    pedestal.position.y = 1.05 + 0.5;
    g.add(pedestal);
    sombra(g);
    ruinas.add(g);
    obstaculos.push({ x: 0, z: 0, r: 2.9 });
  }

  // Aro de runas del altar: se enciende al reunir todos los idolos
  const matRuna = new THREE.MeshBasicMaterial({
    color: 0x331a08, toneMapped: false
  });
  const runa = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 48), matRuna);
  runa.rotation.x = Math.PI / 2;
  runa.position.set(0, yMeseta + 2.7, 0);
  scene.add(runa);

  const haz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.3, 60, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc34a, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false
    })
  );
  haz.position.set(0, yMeseta + 30, 0);
  haz.visible = false;
  scene.add(haz);
  const luzAltar = new THREE.PointLight(0xffc34a, 0, 25, 2);
  luzAltar.position.set(0, yMeseta + 3.5, 0);
  scene.add(luzAltar);
  let altarActivo = false;

  // Antorchas alrededor de las ruinas
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 5.6, z = Math.sin(a) * 5.6;
    const y = altura(x, z);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.9, 8), matMadera);
    poste.position.set(x, y + 0.95, z);
    sombra(poste);
    scene.add(poste);
    crearFuego(x, y + 2.0, z, 0.8, 18);
    obstaculos.push({ x, z, r: 0.25 });
  }

  // ====== ROCAS
  const gRoca = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = gRoca.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 0.78 + Math.abs(Math.sin(v.x * 3.1 + v.y * 5.3 + v.z * 2.7)) * 0.4;
      p.setXYZ(i, v.x * k, v.y * k * 0.75, v.z * k);
    }
    gRoca.computeVertexNormals();
  }
  for (let i = 0; i < (tema.tipo === "montana" ? 60 : 26); i++) {
    const a = rnd() * Math.PI * 2;
    const d = 13 + rnd() * 26;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = altura(x, z);
    if (y < 0.2) continue;
    const s = 0.5 + rnd() * 1.2;
    const roca = new THREE.Mesh(gRoca, matRoca);
    roca.scale.set(s, s, s * (0.8 + rnd() * 0.5));
    roca.position.set(x, y + s * 0.2, z);
    roca.rotation.y = rnd() * 6;
    sombra(roca);
    scene.add(roca);
    obstaculos.push({ x, z, r: s * 0.85 });
  }

  await crearVegetacion({ scene, gltfLoader, tema, rnd, obstaculos, fogata, matMadera, sombra });

  // ====== IDOLOS DORADOS (modelo hecho en Blender)
  const modeloIdolo = (await gltfLoader.loadAsync("/models/idolo.glb?v=" + Date.now())).scene;
  sombra(modeloIdolo);

  const texBrillo = textura(64, (ctx, t) => {
    const g = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
    g.addColorStop(0, "rgba(255,220,120,1)");
    g.addColorStop(1, "rgba(255,180,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, t, t);
  });

  const posIdolos = tema.idolos;
  const idolos = posIdolos.map(([px, pz]) => {
    let x = px, z = pz;
    while (altura(x, z) < 0.45) { x *= 0.93; z *= 0.93; }
    const y = altura(x, z);
    const obj = modeloIdolo.clone(true);
    obj.position.set(x, y + 0.5, z);
    obj.scale.setScalar(1.4);
    scene.add(obj);
    const brillo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texBrillo, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, fog: false
    }));
    brillo.scale.setScalar(2.4);
    brillo.position.set(x, y + 1.25, z);
    scene.add(brillo);
    const luz = new THREE.PointLight(0xffc040, 5, 7, 2);
    luz.position.set(x, y + 1.3, z);
    scene.add(luz);
    return { obj, brillo, luz, x, z, y, recogido: false };
  });

  const { portalDatos, mostrarPortal, ocultarPortal } = crearPortal(scene, animables, matMadera);

  // nevada (solo en la montaña); los botiquines y kits de arma aparecen al azar (juego/suministros.js)
  const nieve = tema.nieve ? crearNieve(scene) : null;

  function desactivarAltar() {
    altarActivo = false;
    matRuna.color.set(0x331a08);
    haz.visible = false;
    luzAltar.intensity = 0;
  }

  // ====== INTERFAZ DEL MUNDO
  function resolver(p, radio) {
    // saca a la entidad de los obstaculos (circulos)
    for (const o of obstaculos) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const min = o.r + radio;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = o.x + (dx / d) * min;
        p.z = o.z + (dz / d) * min;
      }
    }
  }

  function esAgua(x, z) {
    return altura(x, z) < 0.0;
  }

  // el mar se puede nadar hasta cierta distancia de la isla
  function dentroDelMapa(x, z) {
    return Math.hypot(x, z) < tema.limite;
  }

  function actualizar(t, dt, jugador) {
    for (const f of animables) f(t);
    if (nieve) nieve.actualizar(t, dt, jugador);

    // El cielo y las estrellas siguen a la camara; el sol sigue al jugador
    sol.position.copy(jugador).addScaledVector(dirSol, 70);
    sol.target.position.copy(jugador);

    for (const [i, id] of idolos.entries()) {
      if (id.recogido) continue;
      id.obj.rotation.y = t * 1.4 + i;
      id.obj.position.y = id.y + 0.5 + Math.sin(t * 2 + i) * 0.12;
      const k = 1 + Math.sin(t * 3 + i) * 0.15;
      id.brillo.scale.setScalar(2.4 * k);
    }

    if (altarActivo) {
      runa.rotation.z = t * 1.2;
      luzAltar.intensity = 40 + Math.sin(t * 4) * 8;
    }
  }

  function activarAltar() {
    altarActivo = true;
    matRuna.color.set(0xffc34a);
    haz.visible = true;
    luzAltar.intensity = 40;
  }

  function seguirCamara(camPos) {
    cielo.position.copy(camPos);
    estrellas.position.copy(camPos);
  }

  return {
    altura, agua, resolver, esAgua, dentroDelMapa, actualizar, activarAltar, desactivarAltar, seguirCamara,
    mostrarPortal, ocultarPortal, portal: portalDatos,
    idolos, obstaculos, fogata, altar, fuegos,
    spawn: tema.spawn, salida: tema.salida, tema,
    oasis: tema.tipo === "desierto" ? OASIS : null
  };
}

