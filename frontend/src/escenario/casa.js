// Escena final: la cabaña de Max por dentro, con su cama, una lampara y el idolo en la repisa.
import * as THREE from 'three';

export function crearCasa(modeloIdolo) {
  const g = new THREE.Group();
  const madera = new THREE.MeshStandardMaterial({ color: 0x6a4527, roughness: 0.9 });
  const maderaOscura = new THREE.MeshStandardMaterial({ color: 0x3f2814, roughness: 0.9 });
  const pared = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1, side: THREE.DoubleSide });
  const caja = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // habitacion: 8 x 7 m, la cama queda en el centro (z de -2.0 a +0.15)
  caja(8, 0.2, 7, madera, 0, -0.1, -0.9);                  // suelo
  caja(8, 3.2, 0.2, pared, 0, 1.6, -4.4);                  // pared del fondo
  caja(8, 3.2, 0.2, pared, 0, 1.6, 2.6);                   // pared de atras
  caja(0.2, 3.2, 7, pared, -4, 1.6, -0.9);                 // pared con ventana
  caja(0.2, 3.2, 7, pared, 4, 1.6, -0.9);
  caja(8, 0.2, 7, maderaOscura, 0, 3.3, -0.9);             // techo
  for (const x of [-2.6, 0, 2.6]) caja(0.25, 0.25, 7, maderaOscura, x, 3.1, -0.9);   // vigas

  // ventana con luz de luna
  caja(0.1, 1.3, 1.8, maderaOscura, -3.88, 1.8, -1.2);
  const luna = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x7f9ad8, toneMapped: false }));
  luna.rotation.y = Math.PI / 2;
  luna.position.set(-3.81, 1.8, -1.2);
  g.add(luna);

  // cama (cabecera hacia -z) con almohada y manta
  caja(1.5, 0.12, 2.5, maderaOscura, 0, 0.1, -0.95);       // base
  caja(1.4, 0.18, 2.4, new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 1 }), 0, 0.11, -0.95);
  caja(1.5, 0.9, 0.12, maderaOscura, 0, 0.5, -2.2);        // cabecera
  caja(0.55, 0.12, 0.38, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 1 }), 0, 0.2, -1.75);
  caja(1.42, 0.12, 1.0, new THREE.MeshStandardMaterial({ color: 0x3f6f8f, roughness: 1 }), 0, 0.38, -0.05);

  // alfombra, mesa con lampara y repisa con el idolo
  const alfombra = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.02, 32),
    new THREE.MeshStandardMaterial({ color: 0x7a2f2a, roughness: 1 }));
  alfombra.position.set(0, 0.01, 1.4);
  alfombra.receiveShadow = true;
  g.add(alfombra);
  caja(0.9, 0.8, 0.7, madera, 1.8, 0.4, -1.8);
  const pantalla = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false }));
  pantalla.position.set(1.8, 0.95, -1.8);
  g.add(pantalla);
  const lampara = new THREE.PointLight(0xffb468, 14, 9, 2);
  lampara.position.set(1.8, 1.2, -1.8);
  g.add(lampara);
  caja(1.6, 0.08, 0.4, maderaOscura, 3.1, 1.6, -3.3);
  if (modeloIdolo) {
    const idolo = modeloIdolo.clone(true);
    idolo.scale.setScalar(0.9);
    idolo.position.set(3.1, 1.64, -3.3);
    g.add(idolo);
    const brillo = new THREE.PointLight(0xffc040, 3, 4, 2);
    brillo.position.set(3.1, 2.1, -3.0);
    g.add(brillo);
  }

  g.add(new THREE.HemisphereLight(0x6a6f9a, 0x2a1d14, 0.9));
  return g;
}

// Lugar de la cabaña en el mapa (muy lejos del mundo) y arreglo de la escena final.
const CASA_POS = new THREE.Vector3(5000, 0, 5000);
export async function montarEscenaFinal({ scene, gltfLoader, jugador, axel }) {
  const idolo = await gltfLoader.loadAsync("/models/idolo.glb");
  const casa = crearCasa(idolo.scene);
  casa.position.copy(CASA_POS);
  scene.add(casa);
  scene.background = new THREE.Color(0x0d1220);
  scene.fog = null;

  jugador.pos.set(CASA_POS.x, 0, CASA_POS.z - 0.9);        // centro de la camara orbital
  axel.grupo.position.set(CASA_POS.x, 0, CASA_POS.z);      // pies de Max, al pie de la cama
  axel.mirarHacia(0, 1);
  axel.descansando = true;
  axel.grupo.visible = true;
}
