// Frio de la montaña: dos barras. CALOR se llena junto al fuego y se gasta despacio; mientras
// quede calor el cuerpo resiste. Sin calor sube el FRIO y, al llegar a 100, Max pierde vida.
// Solo esta activo en el nivel de la montaña.
const RADIO_FUEGO = 3.6;      // distancia (m) a la que un fuego da calor

export function crearFrio() {
  const f = { frio: 0, calor: 40, activo: false, congelando: false };

  // se llama al empezar cada nivel
  f.reiniciar = (activo) => {
    f.activo = activo;
    f.frio = 0;
    f.calor = 40;
    f.congelando = false;
  };

  // true si algun fuego del mundo esta lo bastante cerca
  f.cercaDelFuego = (pos, fuegos) =>
    fuegos.some((u) => Math.hypot(pos.x - u.grupo.position.x, pos.z - u.grupo.position.z) < RADIO_FUEGO);

  // devuelve la vida por segundo que se pierde por congelacion
  f.actualizar = (dt, junto) => {
    f.congelando = false;
    if (!f.activo) return 0;
    if (junto) {                               // junto al fuego: sube el calor y baja el frio
      f.calor = Math.min(100, f.calor + 28 * dt);
      f.frio = Math.max(0, f.frio - 18 * dt);
    } else if (f.calor > 0) {                  // con calor guardado: se gasta, el frio retrocede
      f.calor = Math.max(0, f.calor - 3.2 * dt);
      f.frio = Math.max(0, f.frio - 2 * dt);
    } else {                                   // sin calor: el frio avanza
      f.frio = Math.min(100, f.frio + 5 * dt);
    }
    f.congelando = f.frio >= 100;
    return f.congelando ? 3 : 0;
  };

  return f;
}
