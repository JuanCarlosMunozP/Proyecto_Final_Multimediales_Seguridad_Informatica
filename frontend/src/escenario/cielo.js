// Cielo con atardecer (shader), estrellas, color de fondo y niebla del nivel.
import * as THREE from 'three';

// devuelve el domo del cielo, las estrellas (ambos siguen a la camara) y la direccion del sol
export function crearCielo(scene, tema, rnd) {
  // ====== CIELO Y FONDO
  const dirSol = new THREE.Vector3(-0.55, 0.16, -0.8).normalize();

  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        sol: { value: dirSol },
        cenit: { value: new THREE.Vector3(...tema.cielo.cenit) },
        medio: { value: new THREE.Vector3(...tema.cielo.medio) },
        horizonte: { value: new THREE.Vector3(...tema.cielo.horizonte) }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 sol;
        uniform vec3 cenit;
        uniform vec3 medio;
        uniform vec3 horizonte;
        void main() {
          float h = vDir.y;
          vec3 c = mix(horizonte, medio, smoothstep(0.0, 0.22, h));
          c = mix(c, cenit, smoothstep(0.18, 0.75, h));
          c = mix(c, vec3(0.30, 0.17, 0.16), smoothstep(0.0, -0.25, h));
          float s = max(dot(normalize(vDir), sol), 0.0);
          c += vec3(1.0, 0.85, 0.55) * pow(s, 400.0) * 4.0;   // disco solar
          c += vec3(1.0, 0.50, 0.20) * pow(s, 10.0) * 0.5;    // resplandor
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    })
  );
  cielo.renderOrder = -2;
  scene.add(cielo);

  // Estrellas (solo se ven arriba, donde el cielo ya oscurece)
  const nEstrellas = 700;
  const pe = new Float32Array(nEstrellas * 3);
  for (let i = 0; i < nEstrellas; i++) {
    const a = rnd() * Math.PI * 2;
    const y = 0.25 + rnd() * 0.75;
    const r = Math.sqrt(1 - y * y);
    pe.set([Math.cos(a) * r * 420, y * 420, Math.sin(a) * r * 420], i * 3);
  }
  const gEstrellas = new THREE.BufferGeometry();
  gEstrellas.setAttribute("position", new THREE.BufferAttribute(pe, 3));
  const estrellas = new THREE.Points(gEstrellas, new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.55, depthWrite: false
  }));
  scene.add(estrellas);

  scene.background = new THREE.Color(0x1a1020);
  scene.fog = new THREE.FogExp2(tema.niebla, tema.densidad);

  return { cielo, estrellas, dirSol };
}
