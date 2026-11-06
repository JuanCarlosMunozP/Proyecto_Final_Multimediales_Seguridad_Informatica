// Sonido del juego. Todo se sintetiza con Web Audio (no hay archivos),
// asi la carpeta public/sounds queda libre para los sonidos definitivos.

export class Sonido {
  constructor() {
    this.ctx = null;
    this.maestro = null;
    this.fuego = null;
  }

  // El navegador solo permite audio despues de un clic del usuario
  iniciar() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.maestro = this.ctx.createGain();
    this.maestro.gain.value = 0.8;
    this.maestro.connect(this.ctx.destination);

    this.ruido = this.crearRuido();
    this.crearOceano();
    this.crearViento();
    this.crearFuego();
    this.crearMusica();
  }

  crearRuido() {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    let ultimo = 0;
    for (let i = 0; i < datos.length; i++) {
      // ruido marron: suena grave y suave, bueno para olas y viento
      ultimo = (ultimo + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      datos[i] = ultimo * 3.5;
    }
    return buffer;
  }

  fuente(buffer, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    return s;
  }

  crearOceano() {
    const ctx = this.ctx;
    const src = this.fuente(this.ruido);
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 500;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0.25;

    // Las olas suben y bajan lento
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const prof = ctx.createGain();
    prof.gain.value = 0.15;
    lfo.connect(prof).connect(ganancia.gain);

    src.connect(filtro).connect(ganancia).connect(this.maestro);
    src.start();
    lfo.start();
  }

  crearViento() {
    const ctx = this.ctx;
    const src = this.fuente(this.ruido);
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 700;
    filtro.Q.value = 0.8;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0.06;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const prof = ctx.createGain();
    prof.gain.value = 0.05;
    lfo.connect(prof).connect(ganancia.gain);
    src.connect(filtro).connect(ganancia).connect(this.maestro);
    src.start();
    lfo.start();
  }

  // Fuego: rugido grave de las llamas, un siseo suave y el crepitar de la lena (chasquidos secos y,
  // de vez en cuando, un tronco que se parte). Todo sale por this.fuego, cuyo volumen depende de
  // la distancia al fuego mas cercano (ver ajustarFuego).
  crearFuego() {
    const ctx = this.ctx;
    this.fuego = ctx.createGain();
    this.fuego.gain.value = 0;
    this.fuego.connect(this.maestro);
    this.volFuego = 0;

    // ruido blanco para los chasquidos y el siseo (el ruido marron del resto es demasiado grave)
    this.ruidoBlanco = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const datos = this.ruidoBlanco.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;

    // rugido: ruido grave que sube y baja como el tiro de las llamas
    const rugido = this.fuente(this.ruido);
    const fr = ctx.createBiquadFilter();
    fr.type = "bandpass";
    fr.frequency.value = 180;
    fr.Q.value = 0.6;
    const gr = ctx.createGain();
    gr.gain.value = 0.9;
    rugido.connect(fr).connect(gr).connect(this.fuego);
    rugido.start();
    setInterval(() => {
      if (this.volFuego > 0.02) gr.gain.setTargetAtTime(0.6 + Math.random() * 0.7, ctx.currentTime, 0.25);
    }, 350);

    // siseo suave de fondo
    const siseo = this.fuente(this.ruidoBlanco);
    const fs = ctx.createBiquadFilter();
    fs.type = "bandpass";
    fs.frequency.value = 3200;
    fs.Q.value = 0.5;
    const gs = ctx.createGain();
    gs.gain.value = 0.035;
    siseo.connect(fs).connect(gs).connect(this.fuego);
    siseo.start();

    // crepitar: intervalos al azar; si el fuego queda lejos no se sintetiza nada
    const crepitar = () => {
      if (this.volFuego > 0.02) {
        const r = Math.random();
        if (r < 0.12) this.troncoQuebrado();
        else if (r < 0.55) this.chasquido();
        else if (r < 0.8) { this.chasquido(); setTimeout(() => this.chasquido(), 30 + Math.random() * 60); }
      }
      setTimeout(crepitar, 70 + Math.random() * 260);
    };
    crepitar();
  }

  // chasquido corto de una astilla: rafaga breve de ruido filtrada, cada una con otro tono
  chasquido(fuerza = 0.25 + Math.random() * 0.45) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.fuente(this.ruidoBlanco, false);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700 + Math.random() * 3300;
    f.Q.value = 2 + Math.random() * 5;
    const g = ctx.createGain();
    const largo = 0.012 + Math.random() * 0.03;
    g.gain.setValueAtTime(fuerza * 2.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + largo);
    src.connect(f).connect(g).connect(this.fuego);
    src.start(t, Math.random() * 1.5, largo + 0.02);
  }

  // un leño que se parte: dos chasquidos fuertes y un golpe seco grave
  troncoQuebrado() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.chasquido(0.9);
    setTimeout(() => this.chasquido(0.7), 25 + Math.random() * 30);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.fuego);
    o.start(t);
    o.stop(t + 0.14);
  }

  // distancia: metros al fuego mas cercano (ya compensada por su tamano: una antorcha se oye menos)
  ajustarFuego(distancia) {
    if (!this.fuego) return;
    const v = Math.max(0, 1 - distancia / 16);
    this.volFuego = v;
    this.fuego.gain.setTargetAtTime(v * v * 1.1, this.ctx.currentTime, 0.2);
  }

  // Musica ambiental: acordes lentos (La menor - Fa - Do - Sol) + arpegio suave
  crearMusica() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.11;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 1400;
    bus.connect(filtro).connect(this.maestro);
    this.musica = bus;

    const acordes = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 261.63, 329.63],
      [196.0, 246.94, 293.66]
    ];
    const duracion = 8;
    let i = 0;

    const tocar = () => {
      const t = ctx.currentTime;
      const acorde = acordes[i % acordes.length];
      for (const f of acorde) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.5, t + 2);
        g.gain.linearRampToValueAtTime(0, t + duracion + 1);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + duracion + 1.2);
      }
      // arpegio
      acorde.forEach((f, k) => {
        for (let n = 0; n < 2; n++) {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = f * 2;
          const g = ctx.createGain();
          const ti = t + (k + n * 3) * 1.1 + 0.5;
          g.gain.setValueAtTime(0, ti);
          g.gain.linearRampToValueAtTime(0.35, ti + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, ti + 1.4);
          o.connect(g).connect(bus);
          o.start(ti);
          o.stop(ti + 1.5);
        }
      });
      i++;
    };
    tocar();
    setInterval(tocar, duracion * 1000);
  }

  // ---- efectos puntuales
  tono(frecuencia, duracion, tipo = "sine", volumen = 0.3, hasta = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(frecuencia, t);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volumen, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duracion);
    o.connect(g).connect(this.maestro);
    o.start(t);
    o.stop(t + duracion + 0.05);
  }

  golpeRuido(duracion, frecuencia, volumen) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.fuente(this.ruido, false);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = frecuencia;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volumen, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duracion);
    src.connect(f).connect(g).connect(this.maestro);
    src.start(t, Math.random() * 2, duracion + 0.05);
  }

  paso() {
    this.golpeRuido(0.09, 700 + Math.random() * 300, 0.5);
  }

  salto() {
    this.tono(220, 0.18, "sine", 0.15, 380);
  }

  aterrizaje() {
    this.golpeRuido(0.12, 400, 0.6);
  }

  golpe() {
    this.golpeRuido(0.08, 2500, 0.3); // aire del puñetazo
  }

  disparo() {
    this.golpeRuido(0.12, 1800, 1.0);
    this.tono(180, 0.12, "square", 0.22, 60);
  }

  impacto() {
    this.golpeRuido(0.18, 900, 1.2);
    this.tono(90, 0.15, "square", 0.25, 50);
  }

  dolor() {
    this.tono(300, 0.3, "sawtooth", 0.18, 120);
    this.golpeRuido(0.15, 600, 0.8);
  }

  recoger() {
    // campanita ascendente
    [660, 880, 1320].forEach((f, i) => {
      setTimeout(() => this.tono(f, 0.5, "sine", 0.25), i * 90);
    });
  }

  enemigoCae() {
    this.tono(160, 0.5, "sawtooth", 0.2, 50);
    this.golpeRuido(0.3, 500, 0.7);
  }

  victoria() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tono(f, 0.9, "triangle", 0.3), i * 160);
    });
  }

  derrota() {
    [392, 311, 261, 196].forEach((f, i) => {
      setTimeout(() => this.tono(f, 0.8, "sawtooth", 0.2), i * 260);
    });
  }
}
