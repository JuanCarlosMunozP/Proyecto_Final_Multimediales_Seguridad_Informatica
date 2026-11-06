// Utilidades del escenario: numeros al azar con semilla y texturas dibujadas en canvas.
import * as THREE from 'three';

export function aleatorio(semilla) {
  // generador con semilla: el mapa sale igual en cada partida
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function textura(tam, dibujar, repetir = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tam;
  dibujar(canvas.getContext("2d"), tam);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repetir, repetir);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Quita del escenario los objetos de un nivel y libera su memoria de video (geometrias, materiales
// y texturas); sin esto, cada nivel que se carga deja sus recursos ocupados en la tarjeta grafica.
export function liberar(scene, objetos) {
  for (const o of objetos) {
    scene.remove(o);
    o.traverse((n) => {
      n.geometry?.dispose();
      for (const m of [].concat(n.material || [])) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
  }
}
