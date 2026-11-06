// Peinados hechos con mechones: cada mechon es una cinta con grosor que nace en el
// cuero cabelludo, sigue la forma del craneo y se levanta o cae segun el peinado.
// Se construye en coordenadas del modelo (en reposo) y se pega al hueso de la cabeza.
import * as THREE from 'three';

// craneo aproximado del modelo Mixamo (medido sobre la malla Ch17_Body)
const CENTRO = new THREE.Vector3(0, 1.64, 0.022);
const RADIO = new THREE.Vector3(0.092, 0.122, 0.112);
const GROSOR_CASCO = 0.011;

const BAJO = new THREE.Vector3(0, -1, 0);

function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// punto del craneo para (theta desde la coronilla, phi desde la frente hacia +x)
function puntoCraneo(theta, phi, extra = 0) {
  const p = new THREE.Vector3(
    RADIO.x * Math.sin(theta) * Math.sin(phi),
    RADIO.y * Math.cos(theta),
    RADIO.z * Math.sin(theta) * Math.cos(phi));
  const n = normalDe(p);
  return p.add(CENTRO).addScaledVector(n, extra);
}

function normalDe(local) {
  return new THREE.Vector3(local.x / (RADIO.x * RADIO.x), local.y / (RADIO.y * RADIO.y), local.z / (RADIO.z * RADIO.z)).normalize();
}

// Un mechon recorre la superficie del craneo siguiendo 'dir' (direccion deseada en el
// espacio, proyectada sobre el craneo en cada paso) y se despega segun 'altura'.
function trazarMechon(o) {
  const n = o.pasos ?? 9;
  const paso = o.largo / n;
  const local = new THREE.Vector3(
    RADIO.x * Math.sin(o.theta) * Math.sin(o.phi),
    RADIO.y * Math.cos(o.theta),
    RADIO.z * Math.sin(o.theta) * Math.cos(o.phi));
  const puntos = [];
  const normales = [];
  let dirPrev = o.dir.clone().normalize();
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const normal = normalDe(local);
    // el pelo se despega al principio (volumen) y la punta cae o se curva
    const despegue = GROSOR_CASCO * 0.6 + o.base + o.altura * Math.sin(Math.PI * Math.min(1, s * (o.fase ?? 1))) + (o.punta ?? 0) * s * s;
    puntos.push(local.clone().add(CENTRO).addScaledVector(normal, despegue));
    normales.push(normal.clone());
    // direccion de avance: dir + algo de gravedad + giro lateral (rizo)
    const d = o.dir.clone().multiplyScalar(1)
      .addScaledVector(BAJO, (o.gravedad ?? 0) * s)
      .addScaledVector(new THREE.Vector3().crossVectors(normal, o.dir).normalize(), (o.rizo ?? 0) * (s - 0.3));
    d.addScaledVector(normal, -d.dot(normal)); // proyectar al plano tangente
    if (d.lengthSq() < 1e-6) d.copy(dirPrev); else d.normalize();
    dirPrev = d;
    local.addScaledVector(d, paso);
    // volver a la superficie del elipsoide
    const q = new THREE.Vector3(local.x / RADIO.x, local.y / RADIO.y, local.z / RADIO.z).normalize();
    local.set(q.x * RADIO.x, q.y * RADIO.y, q.z * RADIO.z);
  }
  return { puntos, normales };
}

const ANILLO = 4;
const ESCALA_ANCHO = 0.55;   // mechones finos y muchos: asi se lee como pelo y no como placas
const REPETICIONES = 3;

function cintaDeMechon(mechon, o, color, geo) {
  const { puntos, normales } = mechon;
  const n = puntos.length;
  const base = geo.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    const a = puntos[Math.max(0, i - 1)], b = puntos[Math.min(n - 1, i + 1)];
    const tg = b.clone().sub(a).normalize();
    const nr = normales[i].clone();
    const an = new THREE.Vector3().crossVectors(tg, nr).normalize(); // a lo ancho
    const nm = new THREE.Vector3().crossVectors(an, tg).normalize();  // hacia afuera
    // ancho: robusto en el centro, punta fina
    const w = o.ancho * ESCALA_ANCHO * (0.7 + 0.5 * Math.sin(Math.PI * Math.min(1, s * 1.4))) * Math.max(0.04, 1 - Math.pow(s, o.afinado ?? 2.4));
    const t = o.grueso * Math.max(0.2, 1 - 0.7 * s);
    // las raices son mas oscuras (sombra del propio pelo)
    const sombra = 0.55 + 0.45 * Math.min(1, s * 1.6);
    for (let k = 0; k < ANILLO; k++) {
      const ang = (k / ANILLO) * Math.PI * 2;
      const p = puntos[i].clone()
        .addScaledVector(an, Math.cos(ang) * w)
        .addScaledVector(nm, Math.sin(ang) * t);
      geo.pos.push(p.x, p.y, p.z);
      geo.col.push(color.r * sombra, color.g * sombra, color.b * sombra);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < ANILLO; k++) {
      const a = base + i * ANILLO + k;
      const b = base + i * ANILLO + (k + 1) % ANILLO;
      const c = a + ANILLO, d = b + ANILLO;
      geo.idx.push(a, c, b, b, c, d);
    }
  }
}

// casquete que tapa el cuero cabelludo; 'linea(phi)' = theta maximo (donde acaba el pelo)
function casquete(linea, color, geo, oscuro) {
  const nPhi = 40, nTheta = 14;
  const base = geo.pos.length / 3;
  for (let j = 0; j <= nTheta; j++) {
    for (let i = 0; i < nPhi; i++) {
      const phi = (i / nPhi) * Math.PI * 2 - Math.PI; // 0 = frente
      const theta = (j / nTheta) * linea(Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))), phi);
      const p = puntoCraneo(theta, phi, GROSOR_CASCO);
      geo.pos.push(p.x, p.y, p.z);
      const k = oscuro + 0.4 * Math.pow(j / nTheta, 3);   // el borde se aclara: no se lee como una banda negra
      geo.col.push(color.r * k, color.g * k, color.b * k);
    }
  }
  for (let j = 0; j < nTheta; j++) {
    for (let i = 0; i < nPhi; i++) {
      const a = base + j * nPhi + i;
      const b = base + j * nPhi + (i + 1) % nPhi;
      const c = a + nPhi, d = b + nPhi;
      geo.idx.push(a, b, c, b, d, c);
    }
  }
}

const dirV = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ estilos
// Todos los estilos reciben el generador aleatorio y devuelven la lista de mechones.
// Convencion: +x = lado izquierdo del personaje, +z = frente, -z = nuca.
const ESTILOS = {
  // Axel: pelo medio con volumen arriba; el flequillo cruza la frente hacia su derecha (-x),
  // los lados son cortos y bajan hasta cubrir la parte alta de la oreja y la nuca.
  axel: {
    casco: 0.5,
    corte: 1,
    linea: (a) => {
      const f = a / Math.PI;                 // 0 = frente, 0.5 = costado, 1 = nuca
      return f < 0.5 ? 1.22 + 0.6 * f : 1.52 + 1.0 * (f - 0.5);
    },
    mechones(r) {
      const L = [];
      for (let i = 0; i < 90; i++) {         // parte superior: peinada atras y al lado
        L.push({
          theta: 0.08 + r() * 0.85, phi: -Math.PI + r() * Math.PI * 2,
          dir: dirV(-0.55 - r() * 0.2, 0.1, -0.85 + r() * 0.2),
          largo: 0.12 + r() * 0.05, base: 0.005, altura: 0.012 + r() * 0.012, punta: -0.003,
          gravedad: 0.5, rizo: (r() - 0.5) * 0.4, ancho: 0.015 + r() * 0.005, grueso: 0.005
        });
      }
      for (let i = 0; i < 60; i++) {         // flequillo con volumen, de la raya hacia -x
        L.push({
          theta: 0.6 + r() * 0.65, phi: -0.8 + r() * 1.7,
          dir: dirV(-1.0, 0.15 + r() * 0.2, -0.3 + r() * 0.25),
          largo: (0.11 + r() * 0.05) * 0.22, base: 0.008, altura: 0.020 + r() * 0.016, fase: 0.8, punta: -0.01,
          gravedad: 0.8, rizo: (r() - 0.5) * 0.3, ancho: 0.016 + r() * 0.005, grueso: 0.005
        });
      }
      for (let i = 0; i < 40; i++) {         // mechones que caen sobre la frente
        L.push({
          theta: 0.45 + r() * 0.5, phi: -0.7 + r() * 1.5,
          dir: dirV(-0.7 - r() * 0.3, 0.35, 0.65),
          largo: (0.09 + r() * 0.04) * 0.22, base: 0.008, altura: 0.02 + r() * 0.012, fase: 0.6, punta: -0.012,
          gravedad: 0.9, rizo: (r() - 0.5) * 0.3, ancho: 0.015 + r() * 0.004, grueso: 0.005
        });
      }
      for (let i = 0; i < 80; i++) {         // laterales cortos
        const lado = i % 2 ? 1 : -1;
        L.push({
          theta: 0.95 + r() * 0.55, phi: lado * (0.9 + r() * 1.5),
          dir: dirV(lado * 0.15, -1, -0.4 + r() * 0.2),
          largo: 0.03 + r() * 0.025, base: 0.005, altura: 0.006 + r() * 0.006, punta: 0.003,
          gravedad: 0.6, rizo: (r() - 0.5) * 0.3, ancho: 0.013 + r() * 0.003, grueso: 0.0045
        });
      }
      for (let i = 0; i < 50; i++) {         // nuca
        L.push({
          theta: 1.45 + r() * 0.55, phi: Math.PI * (0.65 + r() * 0.35) * (i % 2 ? 1 : -1),
          dir: dirV((r() - 0.5) * 0.4, -1, -0.15),
          largo: 0.04 + r() * 0.04, base: 0.005, altura: 0.006, punta: 0.006,
          gravedad: 0.4, ancho: 0.014, grueso: 0.0045
        });
      }
      return L;
    }
  },

  // Mercenario: lados casi rapados y la parte de arriba peinada hacia atras, con un
  // tupe corto al frente y un mechon que cae sobre la sien. Mas corto y liso que Axel.
  mercenario: {
    casco: 0.3,   // lados rapados: la piel de la cabeza se ve oscura, no como plastico brillante
    corte: 0.88,
    linea: (a) => {
      const f = a / Math.PI;
      return f < 0.5 ? 1.18 + 0.45 * f : 1.405 + 0.9 * (f - 0.5);
    },
    mechones(r) {
      const L = [];
      for (let i = 0; i < 90; i++) {         // arriba: liso hacia atras
        L.push({
          theta: 0.08 + r() * 0.8, phi: -Math.PI + r() * Math.PI * 2,
          dir: dirV(-0.25 - r() * 0.15, 0.2, -1),
          largo: 0.10 + r() * 0.04, base: 0.005, altura: 0.012 + r() * 0.010, fase: 0.9, punta: 0.0,
          gravedad: 0.15, rizo: (r() - 0.5) * 0.2, ancho: 0.014 + r() * 0.004, grueso: 0.005, afinado: 1.8
        });
      }
      for (let i = 0; i < 50; i++) {         // tupe: se levanta y se echa hacia atras
        L.push({
          theta: 0.5 + r() * 0.5, phi: -0.85 + r() * 1.7,
          dir: dirV(-0.3 * r(), 0.45, -1),
          largo: 0.10 + r() * 0.04, base: 0.008, altura: 0.016 + r() * 0.010, fase: 0.65, punta: 0.002,
          gravedad: 0.0, ancho: 0.0145 + r() * 0.004, grueso: 0.005, afinado: 1.6
        });
      }
      for (let i = 0; i < 16; i++) {         // mechon suelto sobre la sien (-x)
        L.push({
          theta: 0.85 + r() * 0.25, phi: 0.15 + r() * 0.7,
          dir: dirV(-1, 0.1, -0.1),
          largo: 0.08 + r() * 0.03, base: 0.009, altura: 0.014, fase: 0.8, punta: -0.012,
          gravedad: 1.0, ancho: 0.013, grueso: 0.0045
        });
      }
      for (let i = 0; i < 60; i++) {         // laterales y nuca rapados (solo pelusa, lejos de la cara)
        const lado = i % 2 ? 1 : -1;
        L.push({
          theta: 1.15 + r() * 0.7, phi: lado * (1.25 + r() * 1.9),
          dir: dirV(0, -0.4, -1),
          largo: 0.02 + r() * 0.02, base: 0.004, altura: 0.003, punta: 0.001,
          gravedad: 0.3, ancho: 0.010, grueso: 0.004, pasos: 4, afinado: 1.5
        });
      }
      return L;
    }
  }
};

// Construye el cabello (un Mesh) para el estilo y color dados, en coordenadas del modelo.
export function crearCabello(estilo, colorHex) {
  const def = ESTILOS[estilo];
  if (!def) throw new Error("Peinado desconocido: " + estilo);
  const r = aleatorio(estilo === "axel" ? 20240611 : 77123);
  const color = new THREE.Color(colorHex);
  const geo = { pos: [], col: [], idx: [] };

  casquete(def.linea, color, geo, def.casco);
  const todos = [];
  for (let i = 0; i < REPETICIONES; i++) todos.push(...def.mechones(r));
  for (const o of todos) {
    o.largo *= def.corte;      // que tan corto se lleva el peinado
    o.altura *= def.corte;
    o.punta *= def.corte;
    const c = color.clone().multiplyScalar(0.85 + r() * 0.3);
    cintaDeMechon(trazarMechon(o), o, c, geo);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(geo.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(geo.col, 3));
  g.setIndex(geo.idx);
  g.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide
  });
  const malla = new THREE.Mesh(g, mat);
  malla.name = "Cabello_" + estilo;
  malla.castShadow = estilo === "axel";   // el pelo de los mercenarios (40 mil triangulos c/u) no proyecta sombra
  malla.frustumCulled = false;
  return malla;
}
