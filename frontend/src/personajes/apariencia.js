// Apariencia de los humanos: parpadeo, peinado, ropa y el rostro propio de los mercenarios.
// Estos metodos se agregan a `Humano` (ver el final de personaje.js), asi que usan `this`.
import * as THREE from 'three';
import { crearCabello } from './cabello.js';
import { suave } from './ayudas.js';

export const aparienciaHumano = {
  prepararParpadeo() {
    const cabeza = this.cuerpo.getObjectByName("Ch17_Body");
    if (!cabeza?.isMesh || !cabeza.material.map) return;

    cabeza.material.onBeforeCompile = (shader) => {
      shader.uniforms.parpadeo = this.parpadeo;
      shader.fragmentShader = "uniform float parpadeo;\n" + shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         #ifdef USE_MAP
           float ojoIzq = 1.0 - smoothstep(1.0, 1.35,
             length(vec2((vMapUv.x - 0.717) / 0.020, (vMapUv.y - 0.132) / 0.012)));
           float ojoDer = 1.0 - smoothstep(1.0, 1.35,
             length(vec2((vMapUv.x - 0.791) / 0.020, (vMapUv.y - 0.132) / 0.012)));
           vec2 uvParpado = vec2(vMapUv.x, clamp(vMapUv.y + 0.016, 0.0, 1.0));
           vec3 colorParpado = texture2D(map, uvParpado).rgb;
           diffuseColor.rgb = mix(diffuseColor.rgb, colorParpado, parpadeo * max(ojoIzq, ojoDer));
         #endif`
      );
    };
    cabeza.material.customProgramCacheKey = () => "parpadeo-facial-v1";
    cabeza.material.needsUpdate = true;
  },

  // Reemplaza el pelo descargado por un peinado propio (ver cabello.js)
  // colorBarba tiñe Ch17_Hair, que es la barba (y cejas); null = sin barba.
  ponerCabello(estilo, color, colorBarba) {
    const pelo = this.cuerpo.getObjectByName("Ch17_Pelo");
    if (pelo) pelo.visible = false;
    const barba = this.cuerpo.getObjectByName("Ch17_Hair");
    if (barba?.isMesh) {
      if (colorBarba == null) barba.visible = false;   // sin barba
      else { barba.visible = true; barba.material.color.set(colorBarba); }
    }
    const cabeza = this.j.cabeza;
    for (const previo of cabeza.children.filter((c) => c.name.startsWith("Cabello_"))) cabeza.remove(previo); // un modelo clonado ya puede traer otro peinado
    this.cuerpo.updateMatrixWorld(true);
    const malla = crearCabello(estilo, color);
    // la geometria esta en coordenadas del modelo: pasarla al espacio del hueso de la cabeza
    const modeloACabeza = cabeza.matrixWorld.clone().invert().multiply(this.cuerpo.matrixWorld);
    malla.geometry.computeBoundingBox();
    this.cajaCabello = malla.geometry.boundingBox.clone();   // tamaño del peinado (para ajustarle el sombrero)
    malla.geometry.applyMatrix4(modeloACabeza);
    cabeza.add(malla);
    this.cabello = malla;
  },

  personalizarCabelloAxel() {
    this.ponerCabello("axel", 0x1c1009, 0x4a2b17);
    this.ponerSombrero();
  },

  // Fedora de explorador (figuras basicas: ala, copa y banda). Se arma con el tamaño del peinado y se
  // calcula donde queda en dos sitios: puesta en la cabeza o sostenida en la mano izquierda, a un
  // costado. colocarSombrero() la cambia de hueso segun el modo ("cabeza" | "mano" | "oculto").
  ponerSombrero() {
    const caja = this.cajaCabello, cabeza = this.j.cabeza;
    const mano = this.cuerpo.getObjectByName("mixamorig1LeftHand");
    const dedo = this.cuerpo.getObjectByName("mixamorig1LeftHandMiddle1");
    if (!caja || !cabeza || !mano || !dedo) return;
    const ancho = caja.max.x - caja.min.x, fondo = caja.max.z - caja.min.z;
    const r = THREE.MathUtils.clamp(ancho / 2 + 0.008, 0.085, 0.125);   // radio de la copa
    const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const malla = new THREE.Group();            // el origen es el centro de la base de la copa
    const ala = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.065, r + 0.065, 0.008, 28), mat(0x6b4526));
    const copa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.115, 24), mat(0x7a5230));
    copa.position.y = 0.0575;
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.03, 0.03, 24), mat(0x2b1a10));
    banda.position.y = 0.019;
    malla.add(ala, copa, banda);
    malla.scale.z = THREE.MathUtils.clamp(fondo / ancho, 1, 1.3);
    malla.traverse((m) => { m.castShadow = true; });

    // posiciones en el espacio del modelo (pose de reposo) -> espacio de cada hueso
    this.cuerpo.updateMatrixWorld(true);
    const enHueso = (hueso, posicion, rotX = 0) => hueso.matrixWorld.clone().invert()
      .multiply(this.cuerpo.matrixWorld)
      .multiply(new THREE.Matrix4().compose(posicion, new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0)),
        new THREE.Vector3(1, 1, 1)));
    const sobreLaCabeza = new THREE.Vector3((caja.min.x + caja.max.x) / 2, caja.max.y - 0.07, (caja.min.z + caja.max.z) / 2);
    const pMano = this.cuerpo.worldToLocal(mano.getWorldPosition(new THREE.Vector3()));
    const direccion = this.cuerpo.worldToLocal(dedo.getWorldPosition(new THREE.Vector3())).sub(pMano).normalize();
    // en la mano: el borde del ala entre los dedos, la copa hacia afuera (la mano cuelga al costado)
    const enLaMano = pMano.clone().addScaledVector(direccion, r + 0.065).add(new THREE.Vector3(0, 0.03, 0));
    this.sombrero = {
      malla, modo: null,
      cabeza: { hueso: cabeza, matriz: enHueso(cabeza, sobreLaCabeza, -0.06) },   // un poco echado hacia atras
      mano: { hueso: mano, matriz: enHueso(mano, enLaMano) }
    };
    this.colocarSombrero("mano");
  },

  colocarSombrero(modo) {
    const s = this.sombrero;
    if (!s || s.modo === modo) return;
    s.modo = modo;
    s.malla.visible = modo !== "oculto";
    const sitio = s[modo];
    if (!sitio) return;
    sitio.hueso.add(s.malla);
    sitio.matriz.decompose(s.malla.position, s.malla.quaternion, s.malla.scale);
  },

  // Cambia el color de las prendas (mallas Ch17_Vest, Ch17_Shirt, Ch17_Pants, Ch17_Boots)
  // sin tocar piel ni pelo: se conserva la luminosidad de la textura (arrugas, sombras)
  // y se reemplaza solo el tono. colores = { vest: 0xRRGGBB, shirt: ..., pants: ..., boots: ... }
  vestir(colores) {
    this.cuerpo.traverse((o) => {
      if (!o.isMesh) return;
      const prenda = Object.keys(colores).find((p) => o.name.toLowerCase().includes(p));
      if (!prenda) return;
      const tinte = new THREE.Color(colores[prenda]);
      if (colores.leather && (prenda === "vest" || prenda === "shirt")) {
        o.material.roughness = 0.62;
        o.material.metalness = 0.02;
      }
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.tinte = { value: tinte };
        sh.fragmentShader = "uniform vec3 tinte;\n" + sh.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
           float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
           diffuseColor.rgb = tinte * (0.35 + 1.3 * lum);`);
      };
      o.material.needsUpdate = true;
    });
  },

  personalizarMercenario() {
    const cabeza = this.cuerpo.getObjectByName("Ch17_Body");
    if (!cabeza?.isSkinnedMesh) {
      throw new Error("No se encontró la malla facial del mercenario.");
    }

    const indiceCabeza = cabeza.skeleton.bones.findIndex((hueso) => hueso.name === "cabeza");
    const geometria = cabeza.geometry.clone();
    const posicion = geometria.attributes.position;
    const indices = geometria.attributes.skinIndex;
    const pesos = geometria.attributes.skinWeight;
    if (indiceCabeza < 0 || !indices || !pesos) {
      throw new Error("La malla facial del mercenario no tiene pesos de cabeza.");
    }

    for (let i = 0; i < posicion.count; i++) {
      let pesoCabeza = 0;
      for (let j = 0; j < 4; j++) {
        if (indices.getComponent(i, j) === indiceCabeza) {
          pesoCabeza += pesos.getComponent(i, j);
        }
      }
      if (pesoCabeza < 0.5) continue;

      const y = posicion.getY(i);
      const mandibula = suave(1.565, 1.60, y) * (1 - suave(1.635, 1.67, y));
      if (mandibula <= 0) continue;

      posicion.setX(i, posicion.getX(i) * (1 + 0.08 * mandibula));
      const frente = suave(0.04, 0.12, posicion.getZ(i));
      posicion.setZ(i, posicion.getZ(i) + 0.005 * mandibula * frente);
    }
    posicion.needsUpdate = true;
    geometria.computeVertexNormals();
    cabeza.geometry = geometria;

    const mapaOriginal = cabeza.material.map;
    if (!mapaOriginal?.image) {
      throw new Error("No se encontró la textura facial del mercenario.");
    }
    const lienzo = document.createElement("canvas");
    lienzo.width = mapaOriginal.image.width;
    lienzo.height = mapaOriginal.image.height;
    const contexto = lienzo.getContext("2d", { willReadFrequently: true });
    if (!contexto) {
      throw new Error("No se pudo preparar la textura facial del mercenario.");
    }
    contexto.drawImage(mapaOriginal.image, 0, 0);
    const textura = contexto.getImageData(0, 0, lienzo.width, lienzo.height);
    const iris = [[0.717, 0.132], [0.791, 0.132]];
    for (const [u, v] of iris) {
      const centroX = Math.round(u * lienzo.width);
      const centroY = Math.round(v * lienzo.height);
      for (let y = centroY - 7; y <= centroY + 7; y++) {
        for (let x = centroX - 8; x <= centroX + 8; x++) {
          const dx = (x - centroX) / 8;
          const dy = (y - centroY) / 7;
          if (dx * dx + dy * dy > 1) continue;

          const pixel = (y * lienzo.width + x) * 4;
          const rojo = textura.data[pixel];
          const verde = textura.data[pixel + 1];
          const azul = textura.data[pixel + 2];
          const luminancia = rojo * 0.299 + verde * 0.587 + azul * 0.114;
          if (luminancia < 22 || rojo < verde * 1.08 || verde < azul * 1.05) continue;

          textura.data[pixel] = Math.min(255, luminancia * 1.05);
          textura.data[pixel + 1] = Math.min(255, luminancia * 0.88);
          textura.data[pixel + 2] = Math.min(255, luminancia * 0.42);
        }
      }
    }
    contexto.putImageData(textura, 0, 0);
    cabeza.material.map = mapaOriginal.clone();
    cabeza.material.map.image = lienzo;
    cabeza.material.map.needsUpdate = true;
    cabeza.material.needsUpdate = true;

    this.ponerCabello("mercenario", 0x4a2813, 0xb76739);
  },

  actualizarParpadeo(dt) {
    if (this.ojosCerrados) {          // inconsciente: los parpados quedan cerrados, sin parpadear
      this.parpadeo.value = 1;
      return;
    }
    if (this.parpadeoT < 0) {
      this.proximoParpadeo -= dt;
      if (this.proximoParpadeo <= 0) this.parpadeoT = 0;
    }
    if (this.parpadeoT < 0) return;

    this.parpadeoT += dt;
    const duracion = 0.16;
    if (this.parpadeoT >= duracion) {
      this.parpadeo.value = 0;
      this.parpadeoT = -1;
      this.proximoParpadeo = 2.2 + Math.random() * 3.8;
      return;
    }
    this.parpadeo.value = Math.sin(Math.PI * this.parpadeoT / duracion);
  }
};
