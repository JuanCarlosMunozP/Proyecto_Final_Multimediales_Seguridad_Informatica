// Portal de salida del nivel: columna de luz con aro y el vehículo de regreso (bote, refugio o caravana).
import * as THREE from 'three';
import { altura } from './terreno.js';

// Zona disparadora: main.js revisa la distancia a `portalDatos`. Los vehiculos usan la madera del mundo.
export function crearPortal(scene, animables, matMadera) {
  // ====== PORTAL / BALIZA DE REGRESO (zona disparadora, semana 9)
  // Una columna de luz con aro: en los niveles 1 y 2 vive sobre el altar (lleva al siguiente
  // nivel) y en el ultimo nivel esta en el mar, junto al bote que lleva a casa.
  const matHaz = new THREE.MeshBasicMaterial({
    color: 0x7fd8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false
  });
  const portal = new THREE.Group();
  const columna = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 40, 24, 1, true), matHaz);
  columna.position.y = 20;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false }));
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.9;
  const luzPortal = new THREE.PointLight(0x7fd8ff, 25, 18, 2);
  luzPortal.position.y = 2;
  // bote de remos junto a la baliza (solo se ve en el nivel del mar)
  const bote = new THREE.Group();
  {
    const casco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 3.4), matMadera);
    casco.position.y = 0.1;
    const proa = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 4), matMadera);
    proa.rotation.x = Math.PI / 2;
    proa.rotation.z = Math.PI / 4;
    proa.position.set(0, 0.1, 2.35);
    proa.scale.set(1, 1, 0.6);
    const banco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.35), matMadera);
    banco.position.y = 0.4;
    bote.add(casco, proa, banco);
    bote.position.set(2.6, -0.05, 0);
    bote.traverse((m) => { m.castShadow = true; });
  }
  // refugio de montaña y caravana del desierto
  const refugio = new THREE.Group();
  {
    const paredes = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.4), matMadera);
    paredes.position.y = 0.9;
    const techo = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.9 }));
    techo.rotation.y = Math.PI / 4;
    techo.position.y = 2.4;
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }));
    puerta.position.set(0, 0.65, 1.22);
    refugio.add(paredes, techo, puerta);
    refugio.position.set(3.2, 0, 0);
  }
  const caravana = new THREE.Group();
  {
    const lona = new THREE.MeshStandardMaterial({ color: 0xe6dcc0, roughness: 1 });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.6), matMadera);
    caja.position.y = 0.8;
    const toldo = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.8, 12, 1, false, 0, Math.PI), lona);
    toldo.rotation.z = Math.PI / 2;
    toldo.rotation.y = Math.PI / 2;
    toldo.position.y = 1.05;
    caravana.add(caja, toldo);
    for (const dx of [-1, 1]) for (const dz of [-0.9, 0.9]) {
      const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), matMadera);
      rueda.rotation.x = Math.PI / 2;
      rueda.position.set(dx, 0.45, dz);
      caravana.add(rueda);
    }
    caravana.position.set(3.4, 0, 0);
  }
  for (const v of [refugio, caravana]) v.traverse((m) => { m.castShadow = true; });
  portal.add(columna, aro, luzPortal, bote, refugio, caravana);
  portal.visible = false;
  scene.add(portal);
  const portalDatos = { x: 0, z: 0, radio: 2.4, activo: false };
  animables.push((t) => {
    if (!portalDatos.activo) return;
    aro.rotation.z = t * 1.6;
    aro.position.y = 0.9 + Math.sin(t * 2) * 0.12;
    matHaz.opacity = 0.34 + Math.sin(t * 3) * 0.06;
    if (bote.visible) {
      bote.position.y = -0.05 + Math.sin(t * 1.7) * 0.06;
      bote.rotation.z = Math.sin(t * 1.3) * 0.04;
    }
  });

  // coloca la baliza; conBote = true cuando es la salida definitiva por mar
  function mostrarPortal(x, z, vehiculo) {
    portalDatos.x = x; portalDatos.z = z; portalDatos.activo = true;
    portal.position.set(x, Math.max(altura(x, z), -0.05), z);
    bote.visible = vehiculo === "bote";
    refugio.visible = vehiculo === "refugio";
    caravana.visible = vehiculo === "caravana";
    portal.visible = true;
  }
  function ocultarPortal() {
    portalDatos.activo = false;
    portal.visible = false;
  }

  return { portalDatos, mostrarPortal, ocultarPortal };
}
