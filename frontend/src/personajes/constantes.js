// Constantes compartidas por personaje.js y poses.js (en un archivo aparte para no importarse en circulo).
export const ARTICULACIONES = [
  "cadera", "torso", "cabeza",
  "hombro_I", "codo_I", "hombro_D", "codo_D",
  "muslo_I", "rodilla_I", "muslo_D", "rodilla_D"
];

export const DURACION_GOLPE = 0.5;
export const INSTANTE_IMPACTO = 0.25; // segundos desde que empieza el golpe hasta que conecta
