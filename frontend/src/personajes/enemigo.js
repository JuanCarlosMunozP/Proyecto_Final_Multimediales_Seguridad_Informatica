// Mercenarios enemigos: patrullan junto a su puesto, persiguen a Max y lo atacan con el arma que
// les toco en esta partida (puños, cuchillo, bate, machete o pistola).
import * as THREE from 'three';
import { Humano, DURACION_GOLPE, INSTANTE_IMPACTO } from './personaje.js';
import { armaAleatoria, equiparArma, zonaDeBala } from './armas.js';

const VELOCIDAD_BALA = 26;
const previo = new THREE.Vector3(), punto = new THREE.Vector3();   // temporales reutilizados al mover las balas
const matBala = new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false });
const geoBala = new THREE.BoxGeometry(0.04, 0.04, 0.4);

export class Enemigo {
  constructor(modelo, x, z, mundo, scene, arma = armaAleatoria()) {
    this.mundo = mundo;
    this.scene = scene;
    this.humano = new Humano(modelo);
    this.humano.personalizarMercenario();
    this.arma = arma;
    equiparArma(this.humano, arma);
    this.balas = [];            // proyectiles en vuelo: { mesh, vel, vida }
    this.disparoT = -1;         // cuenta regresiva del disparo (apuntar -> disparar -> bajar el arma)
    this.disparado = false;
    this.fogonazoT = 0;
    this.casa = new THREE.Vector2(x, z);
    this.pos = new THREE.Vector3(x, mundo.altura(x, z), z);
    mundo.resolver(this.pos, 0.4);               // si su puesto cae dentro de un arbol, nace al lado
    this.pos.y = mundo.altura(this.pos.x, this.pos.z);
    this.objetivo = new THREE.Vector2(x, z);
    this.vida = 3;
    this.estado = "patrulla";   // patrulla | persigue | ataca | dispara | muerto
    this.espera = Math.random() * 2;
    this.empuje = new THREE.Vector2();
    this.cooldown = 0;
    this.golpeT = -1;           // cuenta regresiva del ataque
    this.golpeAplicado = false;
    this.velocidad = 0;
    this.tiempoMuerto = 0;
    this.quitar = false;
    this.humano.grupo.position.copy(this.pos);
    scene.add(this.humano.grupo);
  }

  get vivo() { return this.estado !== "muerto"; }

  recibirGolpe(dirX, dirZ, dano = 1) {
    if (!this.vivo) return false;
    this.vida -= dano;
    this.humano.destello();
    this.empuje.set(dirX, dirZ).multiplyScalar(6);
    if (this.vida <= 0) {
      this.estado = "muerto";
      this.humano.apuntando = 0;
      this.humano.morir(undefined, { x: dirX, z: dirZ });
      return true; // murio
    }
    if (this.estado !== "dispara") this.estado = "persigue";
    return false;
  }

  // dispara una bala desde la boca del arma hacia el pecho de Max, con un poco de dispersion
  disparar(jugador, sonido) {
    const malla = this.humano.armaMalla;
    const origen = new THREE.Vector3(0, this.arma.largoCanon, 0);
    if (malla) { malla.updateWorldMatrix(true, false); malla.localToWorld(origen); }
    else origen.copy(this.pos).add(new THREE.Vector3(0, 1.3, 0));
    // apunta al cuerpo de Max, pero la mano tiembla: puede pegar en piernas, abdomen, pecho o cabeza
    const blanco = new THREE.Vector3(jugador.pos.x, jugador.pos.y + 0.5 + Math.random() * 1.2, jugador.pos.z);
    const dir = blanco.sub(origen).normalize();
    dir.x += (Math.random() - 0.5) * 0.07;
    dir.y += (Math.random() - 0.5) * 0.05;
    dir.z += (Math.random() - 0.5) * 0.07;
    dir.normalize();
    const mesh = new THREE.Mesh(geoBala, matBala);
    mesh.position.copy(origen);
    mesh.lookAt(origen.clone().add(dir));
    this.scene.add(mesh);
    this.balas.push({ mesh, vel: dir.multiplyScalar(VELOCIDAD_BALA), vida: 1.6 });
    const fogonazo = malla?.userData.fogonazo;
    if (fogonazo) { fogonazo.visible = true; this.fogonazoT = 0.07; }
    sonido?.disparo();
  }

  // Mueve las balas y revisa si alcanzan a Max (cilindro de 0.4 m de radio y 1.8 m de alto, revisado
  // en varios puntos del tramo). El dano depende de la altura donde pega (ver zonaDeBala).
  actualizarBalas(dt, jugador, danar) {
    const obstaculos = this.mundo.obstaculos || [];
    for (let i = this.balas.length - 1; i >= 0; i--) {
      const b = this.balas[i];
      previo.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.vida -= dt;
      let impacto = null;
      let enObstaculo = false;
      let tMax = 1;
      const sx = b.mesh.position.x - previo.x, sz = b.mesh.position.z - previo.z;
      const len2 = sx * sx + sz * sz;
      for (let j = 0; j < obstaculos.length; j++) {
        const o = obstaculos[j];
        const t = len2 > 1e-8 ? Math.max(0, Math.min(1, ((o.x - previo.x) * sx + (o.z - previo.z) * sz) / len2)) : 0;
        const cx = previo.x + sx * t - o.x, cz = previo.z + sz * t - o.z;
        const cy = previo.y + (b.mesh.position.y - previo.y) * t;
        if (cx * cx + cz * cz < o.r * o.r && cy <= this.mundo.altura(o.x, o.z) + Math.max(2.0, o.r * 2.2)) {
          enObstaculo = true;
          if (t < tMax) tMax = t;
        }
      }
      for (let k = 1; k <= 4 && jugador.vivo && !impacto; k++) {
        const tk = k / 4;
        if (tk > tMax) break;
        punto.lerpVectors(previo, b.mesh.position, tk);
        const y = punto.y - jugador.pos.y;
        const px = punto.x - jugador.pos.x, pz = punto.z - jugador.pos.z;
        if (y > 0 && y < 1.8 && Math.hypot(px, pz) < 0.4) {
          const d = jugador.direccion || 0;
          impacto = zonaDeBala(y, px * Math.cos(d) - pz * Math.sin(d));   // + = a la izquierda de Max
        }
      }
      const golpea = !!impacto;
      const alSuelo = b.mesh.position.y < this.mundo.altura(b.mesh.position.x, b.mesh.position.z);
      if (golpea) {
        danar(impacto.dano ?? 0, !!impacto.mortal, impacto.zona, b.vel, impacto.herida);
      }
      if (golpea || enObstaculo || alSuelo || b.vida <= 0) {
        this.scene.remove(b.mesh);
        this.balas.splice(i, 1);
      }
    }
  }

  limpiar() {
    for (const b of this.balas) this.scene.remove(b.mesh);
    this.balas.length = 0;
  }

  // jugador: {pos, vivo}  |  danar(cantidad): callback cuando el enemigo acierta | sonido: para el disparo
  actualizar(dt, tiempo, jugador, danar, sonido) {
    const h = this.humano;
    const p = this.pos;
    const A = this.arma;

    this.actualizarBalas(dt, jugador, danar);
    if (this.fogonazoT > 0 && (this.fogonazoT -= dt) <= 0 && h.armaMalla?.userData.fogonazo) {
      h.armaMalla.userData.fogonazo.visible = false;
    }

    if (this.estado === "muerto") {
      this.tiempoMuerto += dt;
      if (h.activo !== false) h.actualizar(dt, 0, true, tiempo);   // sin animar si no se ve
      if (this.tiempoMuerto > 6) this.quitar = true;
      return;
    }

    const dx = jugador.pos.x - p.x, dz = jugador.pos.z - p.z;
    const dist = Math.hypot(dx, dz);
    this.cooldown -= dt;

    // ---- decidir estado
    if (this.estado !== "ataca" && this.estado !== "dispara") {
      const vision = A.tipo === "pistola" ? 14 : 10;
      if (jugador.vivo && dist < vision) this.estado = "persigue";
      else if (this.estado === "persigue" && (dist > vision + 7 || !jugador.vivo)) this.estado = "patrulla";
    }
    if (this.estado === "persigue" && this.cooldown <= 0) {
      if (A.tipo === "pistola") {
        if (dist < A.rango && jugador.vivo) {        // apunta, dispara y baja el arma
          this.estado = "dispara";
          this.disparoT = 0.65;
          this.disparado = false;
        }
      } else if (dist < A.alcance) {
        this.estado = "ataca";
        this.golpeT = DURACION_GOLPE + 0.1;
        this.golpeAplicado = false;
        h.brazoGolpe = "I";                          // golpear() alterna: asi golpea con la derecha (arma)
        h.golpear();
      }
    }

    let vx = 0, vz = 0;

    if (this.estado === "patrulla") {
      const tx = this.objetivo.x - p.x, tz = this.objetivo.y - p.z;
      const d = Math.hypot(tx, tz);
      if (this.espera > 0) {
        this.espera -= dt;
      } else if (d < 0.5) {
        // elegir otro punto cerca de su puesto
        const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
        this.objetivo.set(this.casa.x + Math.cos(a) * r, this.casa.y + Math.sin(a) * r);
        if (this.mundo.esAgua(this.objetivo.x, this.objetivo.y)) this.objetivo.copy(this.casa);
        this.espera = 1 + Math.random() * 2.5;
      } else {
        vx = (tx / d) * 1.4;
        vz = (tz / d) * 1.4;
      }
    } else if (this.estado === "persigue") {
      // con pistola se queda a media distancia; cuerpo a cuerpo se acerca hasta el alcance
      const parar = A.tipo === "pistola" ? A.distancia : A.alcance * 0.8;
      if (dist > parar) {
        vx = (dx / dist) * 3.4;
        vz = (dz / dist) * 3.4;
      }
      h.mirarHacia(Math.atan2(dx, dz), dt);
    } else if (this.estado === "ataca") {
      h.mirarHacia(Math.atan2(dx, dz), dt);
      this.golpeT -= dt;
      if (this.golpeT < DURACION_GOLPE + 0.1 - INSTANTE_IMPACTO && !this.golpeAplicado) {
        this.golpeAplicado = true;
        if (jugador.vivo && dist < A.alcance + 0.45) danar(A.dano, false, "", { x: dx / dist, z: dz / dist });
      }
      if (this.golpeT <= 0) {
        this.estado = "persigue";
        this.cooldown = A.espera;
      }
    } else if (this.estado === "dispara") {
      h.mirarHacia(Math.atan2(dx, dz), dt, 16);
      this.disparoT -= dt;
      if (this.disparoT < 0.3 && !this.disparado) {
        this.disparado = true;
        this.disparar(jugador, sonido);
      }
      if (this.disparoT <= 0) {
        this.estado = "persigue";
        this.cooldown = A.espera;
      }
    }
    h.apuntando = this.estado === "dispara" ? 1 : 0;   // levanta el brazo del arma al apuntar

    if (this.estado === "patrulla" && (vx || vz)) h.mirarHacia(Math.atan2(vx, vz), dt);

    // ---- mover (con empuje de los golpes recibidos)
    const nx = p.x + (vx + this.empuje.x) * dt;
    const nz = p.z + (vz + this.empuje.y) * dt;
    this.empuje.multiplyScalar(Math.max(0, 1 - dt * 8));
    if (!this.mundo.esAgua(nx, nz)) { p.x = nx; p.z = nz; }
    this.mundo.resolver(p, 0.4);
    p.y = this.mundo.altura(p.x, p.z);

    this.velocidad = Math.hypot(vx, vz);
    h.grupo.position.copy(p);
    if (h.activo !== false) h.actualizar(dt, this.velocidad, true, tiempo);   // fuera de camara no se anima (solo se mueve)
  }
}

// Colision entre personajes: los mercenarios vivos no se atraviesan entre si ni a Max. Cada par
// que se solapa se separa a partes iguales (a Max no se le empuja: cede el mercenario).
// Se llama una vez por cuadro, despues de actualizar a todos.
const RADIO_CUERPO = 0.42;
const vivos = [];                                    // reutilizada cada cuadro
export function separarEnemigos(enemigos, jugador, mundo) {
  vivos.length = 0;
  for (const e of enemigos) if (e.vivo) vivos.push(e);
  if (!vivos.length) return;
  const min = RADIO_CUERPO * 2;
  for (let pasada = 0; pasada < 2; pasada++) {        // dos pasadas: al apartar a uno puede chocar con otro
    for (let i = 0; i < vivos.length; i++) {
      const a = vivos[i];
      for (let j = i + 1; j < vivos.length; j++) {
        const b = vivos[j];
        let dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        let d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }   // justo encima: se empuja al azar
        const k = (min - d) / 2 / d;
        mover(a, -dx * k, -dz * k, mundo);
        mover(b, dx * k, dz * k, mundo);
      }
      {                                                 // tampoco atraviesan a Max (vivo o caido)
        const dx = a.pos.x - jugador.pos.x, dz = a.pos.z - jugador.pos.z;
        const d = Math.hypot(dx, dz), minJ = RADIO_CUERPO + 0.35;
        if (d < minJ && d > 1e-4) mover(a, (dx / d) * (minJ - d), (dz / d) * (minJ - d), mundo);
      }
    }
  }
  for (const e of vivos) {
    e.pos.y = mundo.altura(e.pos.x, e.pos.z);
    e.humano.grupo.position.copy(e.pos);
  }
}

// desplaza a un mercenario sin meterlo al agua ni dentro de arboles o rocas
function mover(e, dx, dz, mundo) {
  const x = e.pos.x + dx, z = e.pos.z + dz;
  if (mundo.esAgua(x, z)) return;
  e.pos.x = x;
  e.pos.z = z;
  mundo.resolver(e.pos, 0.4);
}
