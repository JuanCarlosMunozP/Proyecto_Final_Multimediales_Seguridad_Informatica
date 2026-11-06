// Poses de Humano: cada metodo calcula las rotaciones objetivo de las articulaciones para un
// tipo de movimiento (caminar, nadar, golpear, morir...). Se agregan a `Humano` (ver el final de
// personaje.js), asi que usan `this`. Todos reciben el mismo cuadro `ctx` que arma
// Humano.actualizar: `ctx.o` son las rotaciones objetivo [x, y, z] por articulacion y `ctx.bob`
// es el rebote vertical del cuerpo.
import * as THREE from 'three';
import { suave } from './ayudas.js';
import { ARTICULACIONES, DURACION_GOLPE } from './constantes.js';

export const posesHumano = {
  // Braza en el estanque del oasis.
  poseNadoOasis(ctx) {
    const { velocidad, tiempo, o } = ctx;
    // braza en el estanque: tranquila y con la cabeza fuera. Los brazos se estiran al frente, se
    // abren en arco, se recogen bajo el pecho y vuelven a salir; las piernas se encogen y patean
    // como rana. En el sitio solo chapotea suave.
    const f = 0.4 + 0.6 * Math.min(velocidad / 1.9, 1);
    const p = tiempo * (1.1 + 0.6 * Math.min(velocidad / 1.9, 1));
    const abre = Math.max(0, Math.sin(Math.PI * 2 * p));      // brazos abiertos en arco
    const recoge = Math.max(0, -Math.sin(Math.PI * 2 * p));   // codos recogidos bajo el pecho
    for (const [nom, fuera, codo] of [["I", 1, -1], ["D", -1, 1]]) {   // fuera = signo que aleja el brazo del cuerpo
      o["hombro_" + nom][0] = (-2.85 + 0.45 * abre + 1.15 * recoge) * f - 0.25 * (1 - f);   // con el cuerpo tendido, -2.85 = brazo estirado por delante de la cabeza
      o["hombro_" + nom][2] = fuera * (0.1 + 0.8 * abre) * f;
      o["codo_" + nom][1] = codo * (0.1 + 0.5 * abre + 1.6 * recoge) * f;
    }
    const encoge = Math.max(0, Math.sin(Math.PI * 2 * (p + 0.15))) * f;    // las piernas se encogen y luego patean
    for (const [nom, fuera] of [["I", -1], ["D", 1]]) {
      o["muslo_" + nom][0] = 0.1 + 0.2 * encoge;
      o["muslo_" + nom][2] = fuera * (0.08 + 0.3 * encoge);
      o["rodilla_" + nom][0] = 0.15 + 0.35 * encoge;
    }
    o.torso[0] = -0.08;
    o.cabeza[0] = -0.7;                       // mira al frente, fuera del agua
    ctx.bob = Math.sin(Math.PI * 2 * p) * 0.025;
  },

  // Crol en el mar.
  poseNado(ctx) {
    const { velocidad, tiempo, o } = ctx;
    // crol: brazos que giran alternados, patada de tijera y cuerpo tendido sobre el agua
    const brazada = tiempo * (3.2 + 1.6 * Math.min(velocidad / 3, 1));
    const f = 0.45 + 0.55 * Math.min(velocidad / 2.5, 1);   // en el sitio, brazadas mas suaves
    for (const [lado, nom, ph] of [[-1, "I", brazada], [1, "D", brazada + Math.PI]]) {
      const fase = Math.cos(ph), recobro = Math.max(0, Math.sin(ph));
      o["hombro_" + nom][0] = (-1.35 - 1.5 * fase) * f - 0.2 * (1 - f);
      o["hombro_" + nom][2] = lado * (0.12 + 0.18 * recobro);
      o["codo_" + nom][1] = lado * (0.12 + 1.0 * recobro) * f;
    }
    const patada = Math.sin(tiempo * 12);
    o.muslo_I[0] = 0.12 + 0.28 * patada;
    o.muslo_D[0] = 0.12 - 0.28 * patada;
    o.rodilla_I[0] = 0.18 + 0.2 * Math.max(0, -patada);
    o.rodilla_D[0] = 0.18 + 0.2 * Math.max(0, patada);
    o.torso[1] = 0.28 * Math.cos(brazada) * f;
    o.cabeza[0] = -0.85;                     // levanta la cara para mirar al frente
    o.cabeza[1] = -0.28 * Math.cos(brazada) * f;
    ctx.bob = Math.sin(brazada * 2) * 0.02;
  },

  // Salto o caida: piernas y brazos sueltos en el aire.
  poseAire(ctx) {
    const { tiempo, velocidadVertical, o } = ctx;
    const subida = THREE.MathUtils.clamp(velocidadVertical / 7.2, 0, 1);
    const bajada = THREE.MathUtils.clamp(-velocidadVertical / 7.2, 0, 1);
    const cima = 1 - Math.max(subida, bajada);
    const pedaleo = Math.sin(tiempo * 9);          // las piernas se alternan suavemente en el aire
    const balanceo = pedaleo * 0.3;
    o.muslo_I[0] = -0.38 - 0.18 * subida + 0.12 * bajada + balanceo;
    o.muslo_D[0] = 0.24 - 0.12 * subida + 0.16 * bajada - balanceo;
    o.rodilla_I[0] = 0.58 + 0.25 * cima + 0.12 * bajada + 0.3 * Math.max(0, pedaleo);
    o.rodilla_D[0] = 0.48 + 0.3 * cima + 0.12 * subida + 0.3 * Math.max(0, -pedaleo);
    // brazos: se adelantan un poco al impulsarse (sin abrirse a los lados), quedan
    // sueltos con el codo doblado en la cima y se abren apenas al caer para equilibrar
    const impulso = 0.55 * subida + 0.3 * cima + 0.12 * bajada;
    o.hombro_I[0] = -impulso;
    o.hombro_D[0] = -impulso * 0.9;
    o.hombro_I[2] = 0.1 + 0.16 * cima + 0.22 * bajada;
    o.hombro_D[2] = -(0.1 + 0.16 * cima + 0.22 * bajada);
    o.codo_I[1] = -(0.45 + 0.35 * subida + 0.15 * cima);
    o.codo_D[1] = 0.42 + 0.35 * subida + 0.15 * cima;
    o.torso[0] = -0.12 * subida + 0.15 * bajada;
    o.cabeza[0] = 0.06 * subida - 0.08 * bajada;
    ctx.bob = 0.025 * subida - 0.02 * bajada;
  },

  // Caminar y correr.
  poseCaminar(ctx) {
    const { o, A, s, c, corre } = ctx;
    // caminar / correr: zancada corta, piernas juntas
    const L = THREE.MathUtils.lerp;
    const paso = L(Math.min(A, 1.2) * 0.38, 0.78, corre);
    o.muslo_I[0] = s * paso;
    o.muslo_D[0] = -s * paso;
    o.rodilla_I[0] = Math.max(0, -c) * L(0.8 * Math.min(A, 1.2), 1.7, corre);
    o.rodilla_D[0] = Math.max(0, c) * L(0.8 * Math.min(A, 1.2), 1.7, corre);
    // brazos: balanceo hacia adelante y atras, opuesto a la pierna del mismo lado;
    // el codo se dobla mas cuando el brazo va hacia adelante
    const Ab = Math.min(A, 1.5);
    const vaiven = L(0.62 * Ab, 0.95, corre);
    o.hombro_I[0] = -s * vaiven;
    o.hombro_D[0] = s * vaiven;
    o.codo_I[1] = -L(0.22 + 0.2 * Ab + 0.5 * Ab * Math.max(0, s), 1.2 + 0.25 * s, corre);
    o.codo_D[1] = L(0.22 + 0.2 * Ab + 0.5 * Ab * Math.max(0, -s), 1.2 - 0.25 * s, corre);
    // los brazos se acercan al cuerpo al pasar hacia adelante (no se abren a los lados)
    o.hombro_I[2] = -0.1 * Math.max(0, s) * Ab;
    o.hombro_D[2] = 0.1 * Math.max(0, -s) * Ab;
    // caderas y hombros giran en sentido contrario, la cabeza se mantiene mirando al frente
    o.cadera[1] = s * 0.10 * A;
    o.cadera[2] = -s * 0.04 * Math.min(A, 1.2);
    o.torso[1] = -s * 0.22 * A;
    o.torso[0] = 0.05 + 0.07 * A + 0.17 * corre;   // al correr se inclina hacia adelante
    o.cabeza[1] = s * 0.12 * A;
    o.cabeza[0] = -0.12 * corre;
    ctx.bob = Math.abs(c) * (0.05 * A + 0.04 * corre);
  },

  // Quieto: respira y mira un poco a los lados.
  poseReposo(ctx) {
    const { tiempo, o } = ctx;
    // reposo: respira y mira un poco a los lados
    o.torso[0] = Math.sin(tiempo * 1.8) * 0.012;
    o.hombro_I[2] = -0.04 + Math.sin(tiempo * 1.8) * 0.01;
    o.hombro_D[2] = 0.04 - Math.sin(tiempo * 1.8) * 0.01;
    o.codo_I[1] = -0.18;
    o.codo_D[1] = 0.18;
    o.cabeza[1] = Math.sin(tiempo * 0.5) * 0.18;
  },

  // Amortigua el impacto al tocar el suelo.
  ajusteAterrizaje(ctx) {
    const { dt, o } = ctx;
    const intensidad = this.impactoAterrizaje / 0.18;
    this.impactoAterrizaje = Math.max(0, this.impactoAterrizaje - dt);
    o.muslo_I[0] -= 0.12 * intensidad;
    o.muslo_D[0] -= 0.12 * intensidad;
    o.rodilla_I[0] += 0.72 * intensidad;
    o.rodilla_D[0] += 0.72 * intensidad;
    o.torso[0] += 0.12 * intensidad;
    ctx.bob -= 0.055 * intensidad;
  },

  // Apuntar con el arma: el brazo derecho se estira al frente.
  poseApuntar(ctx) {
    const { o } = ctx;
    const ap = this.apuntando || 0;
    const L = THREE.MathUtils.lerp;
    o.hombro_D[0] = L(o.hombro_D[0], -1.5, ap);
    o.hombro_D[2] = L(o.hombro_D[2], -0.04, ap);
    o.codo_D[1] = L(o.codo_D[1], 0.12, ap);
    o.torso[1] = L(o.torso[1], 0.18, ap);
    o.cabeza[1] = L(o.cabeza[1], -0.12, ap);
  },

  // Golpe de puno recto con un solo brazo.
  poseGolpe(ctx) {
    const { dt, o, punoObj } = ctx;
    if (this.congelarGolpe === undefined) this.golpeT += dt / DURACION_GOLPE;   // congelarGolpe: solo para el visor
    else this.golpeT = this.congelarGolpe;
    const p = Math.min(this.golpeT, 1);
    const der = this.brazoGolpe === "D";
    const at = der ? "D" : "I", gu = der ? "I" : "D";
    const lado = der ? 1 : -1;
    const mezcla = (a, b, t) => a + (b - a) * t;

    // levantar = cuanto sube el brazo desde reposo hasta la guardia (puño junto a la cara);
    // e = cuanto esta estirado. Solo se mueve el brazo que golpea: el otro sigue su pose
    // normal y le tocara cuando golpee el siguiente (se alternan).
    let e = 0, levantar;
    if (p < 0.25) {
      levantar = suave(0, 0.25, p);
    } else if (p < 0.45) {
      levantar = 1;
      e = suave(0.25, 0.45, p);
    } else if (p < 0.58) {
      levantar = 1;
      e = 1;
    } else if (p < 0.8) {
      levantar = 1;
      e = 1 - suave(0.58, 0.8, p);
    } else {
      levantar = 1 - suave(0.8, 1, p);
    }
    const prep = levantar * (1 - e);

    const GUARDIA_H = -0.62, GUARDIA_C = -2.05;
    // el brazo se echa un poco atras antes de salir disparado, y sale rapido y frena suave
    const retro = suave(0.1, 0.25, p) * (1 - e);
    const eRapido = 1 - (1 - e) * (1 - e);
    o["hombro_" + at][0] = mezcla(mezcla(o["hombro_" + at][0], GUARDIA_H + 0.3 * retro, levantar), -1.52, eRapido);
    o["hombro_" + at][2] += lado * 0.12 * levantar * (1 - e);
    o["codo_" + at][1] = lado * mezcla(-GUARDIA_C * levantar, 0.12, eRapido);
    // el otro brazo cuelga flojo con el codo doblado y se echa atras para equilibrar
    o["hombro_" + gu][0] += 0.3 * e;
    o["codo_" + gu][1] = -lado * (0.4 + 0.3 * levantar);
    // el puño se cierra al levantar el brazo y se abre otra vez al bajarlo
    punoObj[at] = 0.3 + 0.7 * suave(0, 0.2, p) * (1 - suave(0.85, 1, p));
    o.torso[1] = lado * mezcla(-0.25 * prep, 0.5, e);
    o.torso[0] = 0.08 + 0.2 * e;
    o.cabeza[1] = -lado * 0.35 * e;
    // postura de pelea: da un paso hacia adelante con la pierna contraria
    const adel = der ? "I" : "D", atras = der ? "D" : "I";
    o["muslo_" + adel][0] = -0.4 * Math.max(prep * 0.5, e);
    o["rodilla_" + adel][0] = 0.25 * e;
    o["muslo_" + atras][0] = 0.3 * Math.max(prep * 0.5, e);
    o["rodilla_" + atras][0] = 0.3 * e;
    ctx.bob = -0.06 * e;
    if (this.congelarGolpe === undefined && this.golpeT >= 1) this.golpeT = -1;
  },

  // Dano recibido: sacudida y destello rojo.
  poseDestello(ctx) {
    const { dt, o } = ctx;
    this.destelloT -= dt;
    const k = Math.max(0, this.destelloT / 0.2);
    o.torso[0] += 0.3 * k;
    o.cabeza[0] = -0.35 * k;
    for (const m of this.mats) m.emissive.setRGB(0.9 * k, 0.05 * k, 0.05 * k);
  },

  // Herida: se agarra la zona golpeada.
  poseHerida(ctx) {
    const { dt, o, A, s } = ctx;
    const hd = this.herida;
    hd.t += dt;
    const w = suave(0, 0.15, hd.t) * (1 - suave(hd.dur - 0.7, hd.dur, hd.t));
    if (hd.t >= hd.dur) this.herida = null;
    const L = THREE.MathUtils.lerp;
    const pon = (n, i, v) => { o[n][i] = L(o[n][i], v, w); };
    const sg = { I: -1, D: 1 };                 // el codo se dobla hacia +/- segun el lado; igual el giro hacia el cuerpo
    const mano = (l, x, dentro, codo) => {      // lleva la mano del lado `l` hacia el cuerpo
      pon("hombro_" + l, 0, x);
      pon("hombro_" + l, 2, dentro * sg[l]);
      pon("codo_" + l, 1, codo * sg[l]);
    };
    const l = hd.lado, op = l === "D" ? "I" : "D";
    if (hd.parte === "abdomen") {
      mano("I", -0.95, 0.55, 1.7);
      mano("D", -0.95, 0.55, 1.7);
      pon("torso", 0, 0.5);
      pon("cabeza", 0, 0.25);
      pon("rodilla_I", 0, 0.2);
      pon("rodilla_D", 0, 0.2);
    } else if (hd.parte === "brazo") {
      mano(l, -0.25, 0.1, 0.6);                 // el brazo herido cuelga doblado
      mano(op, -0.9, 0.9, 1.6);                 // la otra mano lo agarra cruzando el pecho
      pon("torso", 0, 0.2);
      pon("cabeza", 0, 0.12);
    } else {
      mano(l, -0.75, 0.2, 0.9);                 // la mano baja a la pierna herida
      mano(op, -0.3, 0, 0.5);
      pon("torso", 0, 0.4);
      pon("cabeza", 0, 0.15);
      const mal = "muslo_" + l, malR = "rodilla_" + l;
      const rod = hd.parte === "rodilla" ? 0.2 : 0;
      if (A > 0.05) {                           // arrastra la pierna: queda atras y apenas se levanta
        pon(mal, 0, 0.15 + 0.15 * (l === "I" ? s : -s));
        pon(malR, 0, 0.25 + rod);
        pon("cadera", 2, 0.08 * sg[l]);
      } else {                                  // quieto: apoya solo la pierna sana
        pon(mal, 0, -0.12);
        pon(malR, 0, 0.55 + rod);
      }
    }
  },

  // Modelos en T: baja los brazos sumando una rotacion base.
  poseBajarBrazos(ctx) {
    const { o } = ctx;
    o.hombro_I[2] -= this.bajarBrazos;
    o.hombro_D[2] += this.bajarBrazos;
  },

  // Inconsciente boca arriba.
  poseTendido(ctx) {
    const { tiempo, o } = ctx;
    for (const n of ARTICULACIONES) { const r = o[n]; r[0] = r[1] = r[2] = 0; }
    const resp = Math.sin(tiempo * 1.5);
    const baja = this.bajarBrazos || 0;
    o.torso[0] = 0.012 * resp;
    o.hombro_I[2] = 0.32 - baja;
    o.hombro_D[2] = -0.32 + baja;
    o.codo_I[1] = 0.12;
    o.codo_D[1] = -0.12;
    o.muslo_I[2] = -0.1;
    o.muslo_D[2] = 0.1;
    o.rodilla_I[0] = o.rodilla_D[0] = 0.05;
    o.cabeza[1] = 0.9;                      // la cara cae hacia un lado
    o.cabeza[2] = 0.15;
    ctx.bob = 0;
  },

  // Muerte: las rodillas ceden y el cuerpo se desploma.
  poseMuerte(ctx) {
    const { o } = ctx;
    const flexion = suave(0, 0.4, this.muerteT), suelta = suave(0.35, 1, this.muerteT);
    const lado = this.ladoCaida || 1;
    const alFrente = this.tipoCaida === "adelante", deEspaldas = this.tipoCaida === "atras";
    // Al terminar queda tendido y relajado: las rodillas dobladas del desplome se estiran (si no,
    // quedan en alto y parece suspendido), torso y cabeza se aplanan. De frente, la cabeza se
    // gira de lado para no apoyar la cara en el suelo; de lado, las piernas quedan semidobladas.
    const tipo = this.tipoCaida;
    const estira = tipo === "lado" ? 0.6 * suelta : suelta;
    o.muslo_I[0] = o.muslo_D[0] = -0.7 * flexion * (1 - estira);
    o.rodilla_I[0] = o.rodilla_D[0] = 1.3 * flexion * (1 - estira) + (tipo === "lado" ? 0.25 : 0.05) * suelta;
    o.cadera[0] = 0.3 * flexion * (1 - estira);
    o.torso[0] = alFrente ? 0.9 * flexion * (1 - suelta) : deEspaldas ? 0.55 * flexion * (1 - suelta) : 0.55 * flexion * (1 - suelta);
    o.torso[2] = 0;
    o.cabeza[0] = alFrente ? 0.3 * flexion * (1 - suelta) : 0.35 * flexion * (1 - suelta);
    o.cabeza[1] = alFrente ? -lado * 1.1 * suelta : 0;      // cara de lado contra el suelo
    o.cabeza[2] = tipo === "lado" ? (0.8) * lado * suelta : 0;
    // piernas un poco abiertas, como en una persona tendida
    o.muslo_I[2] = -0.06 * suelta; o.muslo_D[2] = 0.06 * suelta;
    // los brazos cuelgan sueltos junto al cuerpo (nada de brazos levantados al quedar en el suelo)
    o.hombro_I[0] = o.hombro_D[0] = -0.35 * flexion * (1 - suelta);
    // (este bloque reemplaza los valores de arriba, asi que hay que volver a sumar el ajuste del
    // modelo en T: sin el, los brazos quedaban abiertos en el suelo)
    const baja = this.bajarBrazos || 0;
    o.hombro_I[2] = 0.08 + 0.2 * suelta - baja;
    o.hombro_D[2] = -0.08 - 0.2 * suelta + baja;
    o.codo_I[1] = -0.4 * flexion + 0.15 * suelta;
    o.codo_D[1] = 0.4 * flexion - 0.15 * suelta;
    if (tipo === "lado") {
      // de lado, el brazo de abajo no puede quedar colgando (levantaria el cuerpo): se
      // dobla hacia el frente y el de arriba queda pegado al costado
      const abajo = lado < 0 ? "I" : "D", arriba = lado < 0 ? "D" : "I", sg = abajo === "D" ? 1 : -1;
      o["hombro_" + abajo][0] = -1.1 * suelta;
      o["hombro_" + abajo][2] = sg * (-0.08 + 0.2 * suelta) - sg * baja;
      o["codo_" + abajo][1] = sg * (0.4 * flexion + 0.9 * suelta);
      o["hombro_" + arriba][2] = -sg * (0.1 * suelta) + sg * baja;
    }
    ctx.bob = 0;
  },
};
