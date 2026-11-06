// Datos de cada nivel: bioma, paleta, cielo, niebla, ídolos, salida y vehículo de regreso.

export const TEMAS = [
  { nombre: "La Playa Perdida", tipo: "isla", semilla: 7, desfase: 0, limite: 66,
    arena: 0xd2b87a, pasto: 0x4f8f3a, pastoOscuro: 0x2f6a2c, hierba: [0.24, 0.55, 0.22], hierbaN: 9000,
    niebla: 0xd98a5a, densidad: 0.0105, mar: 0x1c6a86, solColor: 0xffa860, hemi: 0xffc89a, roca: 0x7d7a72,
    cielo: { cenit: [0.05, 0.09, 0.26], medio: [0.78, 0.32, 0.26], horizonte: [1.0, 0.62, 0.30] },
    idolos: [[-22, -8], [18, -18]], spawn: { x: 0, z: 14.5 }, salida: { x: 0, z: -57 },
    vehiculo: "bote", salidaTexto: "Nada hasta el bote que apareció en el mar.",
    limiteTexto: "Una corriente te empuja de vuelta: cumple los objetivos de la isla para llamar al bote." },
  { nombre: "La Montaña Nevada", tipo: "montana", semilla: 21, desfase: 3, limite: 58,
    arena: 0x8a8578, pasto: 0x6a8050, pastoOscuro: 0x77726a, hierba: [0.27, 0.35, 0.2], hierbaN: 4500,
    cima: { color: 0xf2f6fa, desde: 9 },
    niebla: 0xb4c8dc, densidad: 0.012, mar: 0x2b7ea0, solColor: 0xfff0d8, hemi: 0xc8dcf5, roca: 0x8d8a85,
    cielo: { cenit: [0.08, 0.18, 0.45], medio: [0.38, 0.58, 0.86], horizonte: [0.78, 0.87, 0.96] },
    idolos: [[-22, -25], [26, 20]],
    nieve: true, frio: true, sombrero: false, spawn: { x: 0, z: 48 }, salida: { x: -40, z: -30 },
    vehiculo: "refugio", salidaTexto: "Un refugio de montaña se enciende en la ladera: baja hasta él.",
    limiteTexto: "Los acantilados cierran el paso: cumple los objetivos para abrir el refugio." },
  { nombre: "El Desierto Ardiente", tipo: "desierto", semilla: 33, desfase: 7, limite: 58,
    arena: 0xe3c88a, pasto: 0xd6ad66, pastoOscuro: 0xc09550, hierba: [0.12, 0.3, 0.45], hierbaN: 0,
    niebla: 0xe8b878, densidad: 0.011, mar: 0x1f9aa0, solColor: 0xffc070, hemi: 0xffd9a0, roca: 0xb08a5a,
    cielo: { cenit: [0.2, 0.2, 0.42], medio: [0.95, 0.55, 0.3], horizonte: [1.0, 0.82, 0.5] },
    idolos: [[-26, -14], [10, 28]], spawn: { x: 0, z: 40 }, salida: { x: -38, z: -30 },
    vehiculo: "caravana", salidaTexto: "Una caravana te espera en las dunas: ve hasta ella para volver a casa.",
    limiteTexto: "Una tormenta de arena te devuelve al centro: cumple los objetivos para llamar a la caravana." }
];
