// Daniel, el guia de Max: el mismo cuerpo base con pelo y barba canos y ropa de explorador.
import { Humano } from './personaje.js';

export function crearDaniel(modelo) {
  const daniel = new Humano(modelo);
  daniel.ponerCabello("axel", 0x8e8e8e, 0xb4b4b4);                       // pelo y barba canos
  daniel.vestir({ vest: 0x3d5a36, shirt: 0xd8cfae, pants: 0x6b5d3f, boots: 0x2a2118 }); // ropa de explorador
  return daniel;
}
