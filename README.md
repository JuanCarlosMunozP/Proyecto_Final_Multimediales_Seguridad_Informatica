# La Búsqueda del Ídolo Perdido

Proyecto final de Programación Orientada a Entornos Multimediales.
Juego 3D de acción en tercera persona hecho con **Three.js** (frontend) y **Blender** (modelado).

## Estructura

```
la-busqueda-del-idolo-perdido/
├── frontend/                  Juego (Vite + Three.js)
│   ├── index.html             HUD y pantalla de inicio
│   ├── visor.html             Visor de personajes (herramienta)
│   ├── niveles.html           Visor de los tres niveles (herramienta)
│   ├── src/
│   │   ├── main.js            Arranque: bucle principal, controles y mecánicas
│   │   ├── escenario/         MUNDO: lo que se ve del nivel
│   │   │   ├── mundo.js         arma el nivel (luces, terreno, ruinas, fogata, ídolos)
│   │   │   ├── temas.js         datos de cada bioma (isla, montaña, desierto)
│   │   │   ├── terreno.js       altura del suelo según el bioma
│   │   │   ├── cielo.js         cielo, estrellas, niebla
│   │   │   ├── agua.js          mar y oasis: reglas de nado
│   │   │   ├── vegetacion.js    palmeras, cocos, pinos, cactus, pasto
│   │   │   ├── portal.js        salida del nivel y vehículos (bote, refugio, caravana)
│   │   │   ├── nieve.js         nevada de la montaña (partículas)
│   │   │   ├── botiquines.js    modelos del botiquín y del kit de arma
│   │   │   ├── casa.js          escena final en la cabaña
│   │   │   ├── cinematica.js    cinemática del avión de Daniel cayendo al mar
│   │   │   └── utilidades.js    azar con semilla y texturas de canvas
│   │   ├── personajes/        PERSONAJES: Max, Daniel y mercenarios
│   │   │   ├── personaje.js     esqueleto y animaciones (caminar, correr, saltar, nadar, golpear)
│   │   │   ├── apariencia.js    parpadeo, peinado, ropa y rostro del mercenario
│   │   │   ├── enemigo.js       IA de los mercenarios
│   │   │   ├── daniel.js        el guía Daniel
│   │   │   ├── cabello.js       peinados generados por código
│   │   │   └── ayudas.js        funciones matemáticas de las animaciones
│   │   ├── juego/             LÓGICA: cámara y datos de niveles
│   │   │   ├── camara.js        cámara en tercera persona
│   │   │   ├── frio.js          barras de frío y calor (montaña)
│   │   │   ├── combate.js       golpes y disparos de Max a los mercenarios
│   │   │   ├── suministros.js   botiquines y kits de arma que aparecen al azar
│   │   │   └── datos.js         niveles, objetivos y guiones de Daniel
│   │   ├── interfaz/          INTERFAZ: HUD, diálogos y estilos
│   │   │   ├── hud.js
│   │   │   └── style.css
│   │   ├── cuenta/            CUENTA: interfaz y cliente HTTP del backend
│   │   │   ├── cuenta.js        estado de interfaz y acciones de progreso
│   │   │   ├── apiCliente.js    solicitudes a la API, cookies y token CSRF
│   │   │   └── pantalla.js      formulario de ingreso
│   │   ├── audio/             AUDIO: sonido sintetizado con Web Audio
│   │   │   └── audio.js
│   │   └── herramientas/      HERRAMIENTAS de desarrollo (visores)
│   │       ├── visor.js
│   │       ├── niveles.js
│   │       └── rendimiento.js   mide llamadas de dibujo y triángulos por nivel (/rendimiento.html)
│   └── public/
│       ├── models/            max.glb, daniel.glb, enemigo.glb, idolo.glb, palmera.glb
│       ├── sounds/            (vacía: para los próximos sonidos)
│       └── textures/          (vacía: para las próximas texturas)
├── blender/                   Herramientas y scripts para crear modelos 3D
│   ├── crear_personajes.py    Cuerpo, ropa, pelo, esqueleto y exportación de los .glb
│   └── cara.py                Cabeza esculpida + texturas de piel, ojos y mapa de normales
└── README.md
```

## Cómo ejecutar

### Aplicación completa con Docker

1. Copia `.env.example` a `.env` y reemplaza los valores `CHANGE_ME` por secretos únicos.
2. Desde la raíz del proyecto, ejecuta:

```bash
docker compose --env-file .env -f compose.yaml -f compose.local.yaml up -d --build
```

La aplicación quedará disponible en `https://localhost:8443`. Nginx genera un certificado
autofirmado para desarrollo; el navegador mostrará una advertencia de confianza. La API y
PostgreSQL no se publican directamente al host. Para apagar los servicios:

```bash
docker compose --env-file .env -f compose.yaml -f compose.local.yaml down
```

### Solo el frontend con Vite

```bash
cd frontend
npm install
npm run dev        # abre http://localhost:5173
```

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverse (relativo a la cámara) |
| Shift | Correr |
| Espacio | Saltar |
| F / clic | Golpear |
| Ratón / flechas | Mover la cámara |
| Esc | Pausa |

## Objetivo

Max Montenegro debe cruzar **tres niveles** (una isla, una montaña nevada y un desierto con oasis) para encontrar el ídolo perdido y volver a casa.
En cada nivel hay **2 ídolos dorados** y objetivos sencillos: derrotar a los mercenarios (3 golpes cada uno),
tocar las ruinas (isla), escalar al altar y calentarse en la fogata (montaña) y encontrar el oasis y nadar en él (desierto). Al cumplirlos aparece la **salida** (un bote en el mar, un refugio en la ladera o una caravana en las dunas): llega hasta ella para pasar al siguiente nivel; el último te lleva de vuelta a casa.

## Conceptos de multimedia aplicados

- **Modelado 3D (Blender)**: humanos de cuerpo continuo (modificador Skin + Subdivision), cara
  esculpida por código (nariz, cejas, labios, barba), pelo de mechones, manos con dedos, ropa con volumen,
  esqueleto real con pesos automáticos; además ídolo y palmera. Se exportan a glTF/GLB.
- **Animación**: caminar, correr, saltar, golpear, recibir daño y caer, hechos moviendo las
  articulaciones del modelo; mar con olas, llamas, ídolos flotantes y estrellas.
- **Luces**: sol direccional con sombras, luz hemisférica, luz de relleno fría y luces puntuales
  parpadeantes (fogata, antorchas, ídolos, altar).
- **Color y fondo**: cielo de atardecer con shader propio, estrellas, niebla, tone mapping ACES.
- **Escenarios**: isla con relieve por función de altura, ruinas, arco, altar, rocas y palmeras.
- **Cámara**: tercera persona con ratón, suavizada, con colisión contra terreno y obstáculos,
  sacudida al golpear, y órbita alrededor de Max en el menú.
- **Sonido**: oleaje, viento, fogata (volumen según la distancia), música ambiental, pasos,
  golpes, daño y efectos de recoger/ganar/perder, todo generado en código.
- **Texturas**: generadas en canvas (tierra, piedra, llamas).

## Regenerar los modelos

```bash
blender/blender-portable/blender-4.5.10-windows-x64/blender.exe -b --python blender/crear_personajes.py
```

Los modelos se generan en `frontend/public/models`.

Con `PREVIEW_DIR=<carpeta>` también guarda imágenes de prueba de los personajes.

## Visor de personajes

`http://localhost:5173/niveles.html` recorre los tres niveles (isla, montaña y desierto) con cámara libre; teclas 1-3 para cambiar de nivel.

`http://localhost:5173/visor.html` muestra a Max (el protagonista) y a un mercenario; teclas 1-5 para reposo,
caminar, correr, saltar y golpear (arrastra para girar, rueda para acercar).

## Modo de prueba

`http://localhost:5173/#demo` empieza directamente la partida; `#demo=x,z` además coloca a Max en esa posición.

## Cuentas y progreso

El frontend envía el registro, el inicio/cierre de sesión y las actualizaciones de progreso a la API
FastAPI del backend. El backend valida credenciales y progreso, aplica los controles de seguridad y
persiste los datos en PostgreSQL. La sesión usa una cookie HttpOnly y las solicitudes de escritura
incluyen un token CSRF; el frontend no almacena contraseñas, cuentas ni progreso en Web Storage.

Al ejecutar Vite, el proxy `/api` apunta por defecto a `http://127.0.0.1:8000` (configurable con
`VITE_API_TARGET`), por lo que el backend debe estar disponible para usar cuentas. El modo invitado
permite jugar sin guardar progreso.
