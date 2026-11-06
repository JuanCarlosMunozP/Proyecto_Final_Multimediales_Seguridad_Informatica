// Controles tactiles para moviles y tabletas (sin teclado ni raton):
//   - mitad izquierda de la pantalla: joystick flotante (aparece donde se apoya el dedo). Empujarlo
//     al maximo hace correr.
//   - mitad derecha: arrastrar para mover la camara.
//   - botones: GOLPEAR / DISPARAR, SALTAR, HABLAR (solo cerca de Daniel) y PAUSA.
// Usa eventos de puntero con un identificador por dedo, asi se puede mover y mirar a la vez.
// Entrega el estado en el objeto devuelto; main.js lo lee cada cuadro (mov, correr, saltar).
const RADIO_JOYSTICK = 56;   // px que recorre la perilla
const ZONA_JOYSTICK = 0.5;   // fraccion izquierda de la pantalla donde nace el joystick

function crear(etiqueta, clase, texto, props = {}) {
  const e = Object.assign(document.createElement(etiqueta), { className: clase, textContent: texto }, props);
  return e;
}

// vista = { yaw, pitch }; acciones = { atacar, hablar, pausar }
export function crearControlesTactiles(vista, acciones) {
  const estado = { mov: { x: 0, y: 0 }, correr: false, saltar: false, activo: false };

  const raiz = crear("div", "controles-tactiles oculta", "");
  raiz.id = "tactil";
  const zona = crear("div", "tactil-zona", "");
  const base = crear("div", "tactil-base oculta", "");
  const perilla = crear("div", "tactil-perilla", "");
  base.append(perilla);

  const btnGolpe = crear("button", "tactil-boton tactil-golpe", "GOLPEAR", { type: "button" });
  const btnSalto = crear("button", "tactil-boton tactil-salto", "SALTAR", { type: "button" });
  const btnHablar = crear("button", "tactil-boton tactil-hablar oculta", "HABLAR", { type: "button" });
  const btnPausa = crear("button", "tactil-pausa", "II", { type: "button" });
  btnPausa.setAttribute("aria-label", "Pausa");
  btnGolpe.setAttribute("aria-label", "Golpear o disparar");
  btnSalto.setAttribute("aria-label", "Saltar");
  btnHablar.setAttribute("aria-label", "Hablar con Daniel");
  raiz.append(zona, base, btnGolpe, btnSalto, btnHablar, btnPausa);
  document.body.appendChild(raiz);

  // ---- joystick y camara: un dedo por funcion
  let dedoMov = null, dedoCam = null;
  let origenX = 0, origenY = 0, camX = 0, camY = 0;

  const soltarMov = () => {
    dedoMov = null;
    estado.mov.x = estado.mov.y = 0;
    estado.correr = false;
    base.classList.add("oculta");
  };

  zona.addEventListener("pointerdown", (e) => {
    if (!estado.activo) return;
    e.preventDefault();
    zona.setPointerCapture?.(e.pointerId);
    if (e.clientX < innerWidth * ZONA_JOYSTICK && dedoMov === null) {
      dedoMov = e.pointerId;
      origenX = e.clientX; origenY = e.clientY;
      base.style.left = `${origenX}px`;
      base.style.top = `${origenY}px`;
      perilla.style.transform = "translate(-50%, -50%)";
      base.classList.remove("oculta");
    } else if (dedoCam === null) {
      dedoCam = e.pointerId;
      camX = e.clientX; camY = e.clientY;
    }
  });

  zona.addEventListener("pointermove", (e) => {
    if (e.pointerId === dedoMov) {
      let dx = e.clientX - origenX, dy = e.clientY - origenY;
      const d = Math.hypot(dx, dy);
      if (d > RADIO_JOYSTICK) { dx *= RADIO_JOYSTICK / d; dy *= RADIO_JOYSTICK / d; }
      perilla.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const fuerza = Math.min(1, d / RADIO_JOYSTICK);
      const zonaMuerta = fuerza < 0.18;                   // un temblor del dedo no mueve a Max
      estado.mov.x = zonaMuerta ? 0 : dx / RADIO_JOYSTICK;
      estado.mov.y = zonaMuerta ? 0 : -dy / RADIO_JOYSTICK;   // arriba = adelante
      estado.correr = fuerza > 0.92;
    } else if (e.pointerId === dedoCam) {
      vista.yaw -= (e.clientX - camX) * 0.0055;
      vista.pitch = Math.min(1.15, Math.max(-0.15, vista.pitch + (e.clientY - camY) * 0.004));
      camX = e.clientX; camY = e.clientY;
    }
  });

  const fin = (e) => {
    if (e.pointerId === dedoMov) soltarMov();
    if (e.pointerId === dedoCam) dedoCam = null;
  };
  zona.addEventListener("pointerup", fin);
  zona.addEventListener("pointercancel", fin);
  zona.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---- botones
  const pulsar = (boton, alBajar, alSubir) => {
    boton.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      boton.classList.add("pulsado");
      alBajar();
    });
    const soltar = () => { boton.classList.remove("pulsado"); alSubir?.(); };
    boton.addEventListener("pointerup", soltar);
    boton.addEventListener("pointercancel", soltar);
    boton.addEventListener("pointerleave", soltar);
    boton.addEventListener("contextmenu", (e) => e.preventDefault());
  };
  pulsar(btnGolpe, () => acciones.atacar());
  pulsar(btnSalto, () => { estado.saltar = true; }, () => { estado.saltar = false; });
  pulsar(btnHablar, () => acciones.hablar());
  pulsar(btnPausa, () => acciones.pausar());

  return Object.assign(estado, {
    // se muestran solo mientras se juega (no en menus, pausa ni cinematicas)
    activar(si) {
      if (estado.activo === si) return;
      estado.activo = si;
      raiz.classList.toggle("oculta", !si);
      if (!si) { soltarMov(); dedoCam = null; estado.saltar = false; }
    },
    // el boton HABLAR aparece cerca de Daniel y durante el dialogo
    mostrarHablar(si) { btnHablar.classList.toggle("oculta", !si); },
    // el boton de golpe cambia de texto si Max lleva pistola
    textoGolpe(texto) { if (btnGolpe.textContent !== texto) btnGolpe.textContent = texto; }
  });
}
