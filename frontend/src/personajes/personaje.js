// Personajes: el modelo de Blender se anima moviendo sus articulaciones
// (cadera, torso, hombros, codos, muslos, rodillas). Los enemigos estan en enemigo.js.
import * as THREE from 'three';
import { aparienciaHumano } from './apariencia.js';
import { amortiguar, suave } from './ayudas.js';
import { ARTICULACIONES, DURACION_GOLPE, INSTANTE_IMPACTO } from './constantes.js';
import { posesHumano } from './poses.js';
export { DURACION_GOLPE, INSTANTE_IMPACTO };

// falanges de cada dedo, para cerrar el puño
const DEDOS = ["Index", "Middle", "Ring", "Pinky", "Thumb"];

export const VESTUARIO_AXEL = Object.freeze({
  vest: 0x4b2818,
  shirt: 0x60351f,
  pants: 0x2868b5,
  boots: 0x24170f,
  leather: true
});

export class Humano {
  constructor(modelo) {
    // grupo exterior = posicion y direccion en el mundo; 'cuerpo' = el modelo (se inclina al caer)
    this.grupo = new THREE.Group();
    this.cuerpo = modelo;
    this.grupo.add(modelo);

    this.mats = [];
    modelo.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // la malla se deforma con el esqueleto
        o.material = o.material.clone(); // cada personaje tiene sus propios materiales
        const m = o.material;
        if (m.metalness > 0.2) m.metalness = 0.1;   // los modelos descargados salen demasiado brillantes
        if (m.transparent) {                        // pelo con transparencia: recorte duro, sin problemas de orden
          m.transparent = false;
          m.alphaTest = 0.45;
          m.depthWrite = true;
        }
        this.mats.push(m);
      }
    });

    // Huesos del esqueleto hecho en Blender. Cada hueso tiene su propia orientacion
    // de reposo, asi que guardamos su rotacion de reposo (local y de mundo) para poder
    // aplicar las poses en ejes del mundo: X = adelante/atras, Y = giro, Z = lateral.
    modelo.updateMatrixWorld(true);
    this.j = {};
    this.reposo = {};
    this.pose = {};
    for (const n of ARTICULACIONES) {
      const hueso = modelo.getObjectByName(n);
      this.j[n] = hueso;
      const mundo = hueso.getWorldQuaternion(new THREE.Quaternion());
      this.reposo[n] = {
        local: hueso.quaternion.clone(),
        mundo,
        mundoInv: mundo.clone().invert()
      };
      this.pose[n] = [0, 0, 0];
    }
    // modelos descargados (Mixamo) vienen en T: los brazos salen horizontales. Se bajan
    // siempre sumando una rotacion base a los hombros.
    const pH = this.j.hombro_I.getWorldPosition(new THREE.Vector3());
    const pC = this.j.codo_I.getWorldPosition(new THREE.Vector3());
    this.bajarBrazos = Math.abs(pC.x - pH.x) > Math.abs(pC.y - pH.y) ? 1.45 : 0;
    if (this.bajarBrazos) {           // arranca ya con los brazos abajo, sin animar el descenso
      this.pose.hombro_I[2] = -this.bajarBrazos;
      this.pose.hombro_D[2] = this.bajarBrazos;
    }
    // dedos: se curvan alrededor del eje Z del mundo (en T los dedos apuntan al costado
    // y la palma mira abajo); el signo depende de hacia que lado apunta cada mano
    this.dedos = [];
    for (const lado of ["Left", "Right"]) {
      const signo = lado === "Left" ? 1 : -1;
      const mano = lado === "Left" ? "I" : "D";
      for (const dedo of DEDOS) {
        for (const falange of [1, 2, 3]) {
          const hueso = modelo.getObjectByName(`mixamorig1${lado}Hand${dedo}${falange}`);
          if (!hueso) continue;
          const mundo = hueso.getWorldQuaternion(new THREE.Quaternion());
          this.dedos.push({
            hueso, mano, falange, pulgar: dedo === "Thumb", signo,
            local: hueso.quaternion.clone(), mundo, mundoInv: mundo.clone().invert()
          });
        }
      }
    }
    this.puno = { I: 0.3, D: 0.3 };   // 0 = mano abierta, 1 = puño cerrado
    this._d = new THREE.Quaternion();
    this._c = new THREE.Quaternion();
    this._e = new THREE.Euler();

    this.fase = 0;
    this.golpeT = -1;       // progreso del golpe (0..1), -1 = sin golpear
    this.brazoGolpe = "D";
    this.enSueloAnterior = true;
    this.impactoAterrizaje = 0;
    this.parpadeo = { value: 0 };
    this.parpadeoT = -1;
    this.proximoParpadeo = 2.2 + Math.random() * 3.8;
    this.prepararParpadeo();
    this.destelloT = 0;
    this.muerteT = 0;
    this.muerto = false;
    this.herida = null;
    this.ojosCerrados = false;   // true = inconsciente: parpados cerrados fijos
    this.tendido = false;        // true = boca arriba, flojo, sin fuerzas (cinematicas del naufragio)
    this.direccion = 0;     // hacia donde mira (rad)
    this.alturaCuerpo = 0;  // altura actual del cuerpo respecto al grupo (ya con el anclaje al suelo)
    this.prepararAnclaje();
  }

  // Anclaje al suelo: las poses mueven huesos y el cuerpo sube/baja, asi que ningun numero fijo
  // evita que los pies floten o se hundan. En vez de eso se mide, cada cuadro, el punto mas bajo
  // REAL de la malla ya deformada por el esqueleto y se baja o sube el cuerpo hasta que ese punto
  // toque el suelo (suelas al caminar o agacharse, espalda/costado/pecho al caer muerto).
  // Se miden unos cientos de vertices: los de las suelas (todos) y una muestra del resto.
  prepararAnclaje() {
    this.muestras = [];
    const v = new THREE.Vector3();
    this.cuerpo.updateMatrixWorld(true);
    this.cuerpo.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const n = o.geometry.attributes.position.count;
      const paso = Math.max(1, Math.floor(n / 60));
      const bajos = [];
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < n; i++) {
        if (i % paso === 0) { this.muestras.push({ malla: o, i }); continue; }
        // en reposo cada vertice esta donde dice la geometria (sin calcular el esqueleto: es mucho mas rapido)
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.y < 0.12) bajos.push(i);                       // cerca de los pies en reposo
      }
      const saltoBajos = Math.max(1, Math.floor(bajos.length / 60));
      for (let k = 0; k < bajos.length; k += saltoBajos) this.muestras.push({ malla: o, i: bajos[k] });
    });
  }

  // altura (respecto al suelo bajo el grupo) del punto mas bajo de la malla con la pose actual.
  // `exacto` revisa todos los vertices (caro): solo se usa una vez, cuando el cuerpo ya quedo tendido.
  alturaMinima(exacto = false) {
    this.grupo.updateMatrixWorld(true);
    const v = this._v || (this._v = new THREE.Vector3());
    let min = Infinity;
    const medir = (malla, i) => {
      malla.getVertexPosition(i, v).applyMatrix4(malla.matrixWorld);
      if (v.y < min) min = v.y;
    };
    if (exacto) {
      this.cuerpo.traverse((o) => {
        if (o.isSkinnedMesh) for (let i = 0, n = o.geometry.attributes.position.count; i < n; i++) medir(o, i);
      });
    } else {
      for (const m of this.muestras) medir(m.malla, m.i);
    }
    return min - this.grupo.position.y;
  }

  // Curva los dedos de cada mano: 0 = abierta, 1 = puño cerrado
  cerrarManos(objetivo, k) {
    this.puno.I = amortiguar(this.puno.I, objetivo.I, k);
    this.puno.D = amortiguar(this.puno.D, objetivo.D, k);
    const curvas = [1.45, 1.75, 1.2];
    const curvasPulgar = [0.35, 0.55, 0.5];
    for (const d of this.dedos) {
      const grado = this.puno[d.mano];
      const angulo = grado * (d.pulgar ? curvasPulgar : curvas)[d.falange - 1];
      // dedos hacia el costado: curvar hacia abajo = girar alrededor de Z (el pulgar, hacia adelante)
      if (d.pulgar) this._d.setFromEuler(this._e.set(0, d.signo * angulo, 0, "XYZ"));
      else this._d.setFromEuler(this._e.set(0, 0, -d.signo * angulo, "XYZ"));
      this._c.copy(d.mundoInv).multiply(this._d).multiply(d.mundo);
      d.hueso.quaternion.copy(d.local).multiply(this._c);
    }
  }

  golpear() {
    if (this.golpeT >= 0) return false;
    this.golpeT = 0;
    this.brazoGolpe = this.brazoGolpe === "D" ? "I" : "D"; // alterna punos
    return true;
  }

  destello(segundos = 0.2) {
    this.destelloT = segundos;
  }

  // La caida depende de por donde llega el golpe: `empuje` = {x, z} hacia donde empuja el ataque
  // (del atacante hacia la victima). Si lo empujan en el sentido en que mira, cae de frente; en
  // contra, de espaldas; si viene de un costado, cae de lado (izquierdo o derecho).
  // `caida` fuerza el tipo; sin ninguno de los dos se sortea.
  morir(caida, empuje) {
    this.muerto = true;
    this.herida = null;
    this.ladoCaida = Math.random() < 0.5 ? -1 : 1;     // +1 = cae sobre su lado derecho, -1 = sobre el izquierdo
    if (!caida && empuje && (empuje.x || empuje.z)) {
      const adelante = empuje.x * Math.sin(this.direccion) + empuje.z * Math.cos(this.direccion);
      const izquierda = empuje.x * Math.cos(this.direccion) - empuje.z * Math.sin(this.direccion);
      if (Math.abs(izquierda) > Math.abs(adelante)) {
        caida = "lado";
        this.ladoCaida = izquierda > 0 ? -1 : 1;
      } else {
        caida = adelante > 0 ? "adelante" : "atras";
      }
    }
    const r = Math.random();                          // sin direccion: cada muerte cae distinto
    this.tipoCaida = caida || (r < 0.4 ? "atras" : r < 0.75 ? "adelante" : "lado");
  }

  // Herida que no mata: parte = "brazo" | "abdomen" | "pierna" | "rodilla"; lado = "I" | "D".
  // Brazo y abdomen: se agarra la herida un momento. Pierna y rodilla: se agarra la pierna y
  // camina arrastrandola mientras dura.
  herir(parte, lado = "D") {
    if (this.muerto) return;
    const larga = parte === "pierna" || parte === "rodilla";
    this.herida = { parte, lado, t: 0, dur: larga ? 6 : 2.8 };
  }

  mirarHacia(angulo, dt, velocidadGiro = 12) {
    // gira por el camino mas corto
    let d = angulo - this.direccion;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.direccion += d * Math.min(1, dt * velocidadGiro);
    this.grupo.rotation.y = this.direccion;
  }

  // velocidad: m/s horizontales | enSuelo: bool | tiempo: segundos globales
  // sombrero: "cabeza" | "mano" | "oculto" (solo Max lo tiene; al nadar o descansar se lo quita)
  // Cada cuadro: 1) se arman las rotaciones objetivo segun el movimiento (poses.js), 2) se
  // suavizan hacia los huesos, 3) se inclina el cuerpo y 4) se ancla al suelo.
  actualizar(dt, velocidad, enSuelo, tiempo, velocidadVertical = 0, nadando = false, sombrero = "mano") {
    this.colocarSombrero(this.descansando ? "oculto" : nadando && sombrero === "cabeza" ? "mano" : sombrero);
    const ctx = this.#prepararCuadro(dt, velocidad, enSuelo, tiempo, velocidadVertical, nadando);

    // movimiento base (uno solo)
    if (nadando === "oasis") this.#calcularPose(ctx, posesHumano.poseNadoOasis);
    else if (nadando) this.#calcularPose(ctx, posesHumano.poseNado);
    else if (!enSuelo) this.#calcularPose(ctx, posesHumano.poseAire);
    else if (ctx.A > 0.05) this.#calcularPose(ctx, posesHumano.poseCaminar);
    else this.#calcularPose(ctx, posesHumano.poseReposo);

    // capas que se suman encima, en este orden
    if (this.impactoAterrizaje > 0) this.#calcularPose(ctx, posesHumano.ajusteAterrizaje);
    if ((this.apuntando || 0) > 0.01) this.#calcularPose(ctx, posesHumano.poseApuntar);
    if (this.golpeT >= 0) this.#calcularPose(ctx, posesHumano.poseGolpe);
    if (this.destelloT > 0) this.#calcularPose(ctx, posesHumano.poseDestello);
    if (this.herida) this.#calcularPose(ctx, posesHumano.poseHerida);
    if (this.bajarBrazos) this.#calcularPose(ctx, posesHumano.poseBajarBrazos);
    if (this.tendido && !this.muerto) this.#calcularPose(ctx, posesHumano.poseTendido);
    if (this.muerto) this.#calcularPose(ctx, posesHumano.poseMuerte);

    this.#aplicarPose(ctx);
    this.#inclinarCuerpo(ctx);
    this.#anclarAlSuelo(ctx);
  }

  #calcularPose(ctx, pose) {
    pose.call(this, ctx);
  }

  // Deja listo el cuadro: rotaciones objetivo en cero, parpadeo, aterrizaje y fase de la zancada.
  // Los arreglos se reutilizan cada cuadro (sin basura para el recolector).
  #prepararCuadro(dt, velocidad, enSuelo, tiempo, velocidadVertical, nadando) {
    const ctx = this._cuadro || (this._cuadro = {
      o: Object.fromEntries(ARTICULACIONES.map((n) => [n, [0, 0, 0]])),
      punoObj: { I: 0.3, D: 0.3 }
    });
    const o = ctx.o;
    const punoObj = ctx.punoObj;
    punoObj.I = punoObj.D = 0.3;       // manos relajadas salvo al pelear
    for (const n of ARTICULACIONES) { const r = o[n]; r[0] = r[1] = r[2] = 0; }
    ctx.bob = 0;
    this.actualizarParpadeo(dt);
    if (!enSuelo) this.impactoAterrizaje = 0;
    else if (!this.enSueloAnterior) this.impactoAterrizaje = 0.18;
    this.enSueloAnterior = enSuelo;

    this.fase += dt * velocidad * 2;
    ctx.s = Math.sin(this.fase);
    ctx.c = Math.cos(this.fase);
    ctx.A = THREE.MathUtils.clamp(velocidad / 3.2, 0, 1.7);
    // corre = 0 al caminar, 1 a toda carrera (zancada larga, rodillas altas, brazos a 90 grados)
    ctx.corre = THREE.MathUtils.smoothstep(velocidad, 3.8, 5.8);
    ctx.dt = dt;
    ctx.velocidad = velocidad;
    ctx.enSuelo = enSuelo;
    ctx.tiempo = tiempo;
    ctx.velocidadVertical = velocidadVertical;
    ctx.nadando = nadando;
    return ctx;
  }

  // Suaviza las rotaciones objetivo hacia las articulaciones del esqueleto
  #aplicarPose(ctx) {
    const { dt, o, punoObj } = ctx;
    const k = Math.min(1, dt * 19);
    for (const n of ARTICULACIONES) {
      const p = this.pose[n];
      p[0] = amortiguar(p[0], o[n][0], k);
      p[1] = amortiguar(p[1], o[n][1], k);
      p[2] = amortiguar(p[2], o[n][2], k);
      // rotacion en ejes del mundo -> rotacion en el eje propio del hueso
      this._d.setFromEuler(this._e.set(p[0], p[1], p[2], "XYZ"));
      const r = this.reposo[n];
      this._c.copy(r.mundoInv).multiply(this._d).multiply(r.mundo);
      this.j[n].quaternion.copy(r.local).multiply(this._c);
    }
    this.cerrarManos(punoObj, k);
    ctx.k = k;
  }

  // Inclinacion del cuerpo entero: tendido al nadar, boca arriba al descansar, caida al morir
  #inclinarCuerpo(ctx) {
    const { dt, nadando } = ctx;
    this.nado = amortiguar(this.nado || 0, nadando ? 1 : 0, Math.min(1, dt * 7));

    // nadar: el cuerpo se tiende boca abajo sobre el agua
    if (!this.muerto) {
      // descansando: tumbado boca arriba (escena final en la cama)
      this.cuerpo.rotation.x = this.nado * (nadando === "oasis" ? 1.35 : 1.45) - (this.descansando || this.tendido ? Math.PI / 2 : 0);   // en el oasis va mas incorporado
      this.cuerpo.position.z = -0.85 * this.nado;
    }

    // caida al morir (solo la inclinacion; la altura la fija el anclaje al suelo)
    if (this.muerto) {
      this.muerteT = Math.min(1, this.muerteT + dt * 0.8);        // ~1.25 s en total
      const caida = suave(0.3, 1, this.muerteT);
      const giro = (Math.PI / 2) * caida, lado = this.ladoCaida || 1;
      const tipo = this.tipoCaida;
      this.cuerpo.rotation.x = tipo === "atras" ? -giro : tipo === "adelante" ? giro : 0;
      this.cuerpo.rotation.z = tipo === "lado" ? lado * giro : 0;
    }
  }

  // Altura del cuerpo respecto al grupo
  #anclarAlSuelo(ctx) {
    const { enSuelo, nadando, A, k } = ctx;
    const bob = ctx.bob;
    // altura del cuerpo. En el suelo (de pie, caminando, agachado, golpeando o muerto) se ancla:
    // el punto mas bajo de la malla queda justo sobre el suelo, ni flotando ni hundido.
    // Nadando, descansando en la cama o saltando se usa el rebote de la animacion (en el aire
    // la altura la da la fisica del juego).
    const objetivoY = bob - 0.02 * A + (nadando === "oasis" ? 0.04 : 0.3) * this.nado + (this.descansando ? 0.16 : 0);   // en el oasis va mas hundido: las piernas quedan bajo el agua
    const anclar = (enSuelo || this.muerto) && this.nado < 0.02 && !this.descansando;
    if (anclar) {
      if (this.muerto && this.muerteT >= 1) {
        // tendido del todo: la pose ya no cambia, se mide exacto una sola vez y se conserva
        if (this.alturaTendido === undefined) {
          this.cuerpo.position.y = 0;
          this.alturaTendido = -this.alturaMinima(true);
        }
        this.alturaCuerpo = this.alturaTendido;
      } else {
        this.cuerpo.position.y = 0;
        this.alturaCuerpo = -this.alturaMinima();
      }
    } else {
      this.alturaCuerpo = amortiguar(this.alturaCuerpo, objetivoY, k);
    }
    this.cuerpo.position.y = this.alturaCuerpo;
  }
}

// parpadeo, peinado, ropa y rostro del mercenario viven en apariencia.js
Object.assign(Humano.prototype, aparienciaHumano);
