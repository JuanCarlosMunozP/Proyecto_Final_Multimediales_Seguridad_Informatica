# SRS — Especificación de Requisitos de Software: «La Búsqueda del Ídolo Perdido»

**Versión:** 1.0 (Consolidada para Entrega Académica)
**Estado:** Verificado contra código fuente
**Rama / Commit base:** `dev/jesus` (`8bdba73`)
**Asignaturas integradas:** Creación de Entornos Multimedia · Sistemas de Comunicación y Seguridad Informática

---

## 1. Introducción

### 1.1 Propósito
Definir y verificar formalmente los requisitos funcionales (`RF`), de seguridad (`SEG`) y no funcionales (`RNF`) del videojuego 3D interactivo **«La Búsqueda del Ídolo Perdido»**, vinculando cada requisito con su implementación real en `frontend/src/`, su caso de uso (`CU-001` a `CU-019`) y su evidencia de prueba automatizada en `frontend/tests/`.

### 1.2 Alcance del Sistema (AS-IS Verificado)
Aplicación web 3D interactiva en tercera persona ejecutada íntegramente en el navegador (*100 % client-side SPA*). Permite a un jugador explorar tres biomas 3D (Selva Tropical, Montaña Nevada y Desierto), interactuar con el NPC guía Daniel, superar mecánicas ambientales (hipotermia y calor en montaña), combatir mercenarios armados con detección de impacto por zonas corporales, recuperar tres ídolos de oro, activar portales interdimensionales y visualizar una cinemática final de victoria. Incluye un subsistema local de cuentas e identidad respaldado por `Web Crypto API` (`PBKDF2-SHA256` y `HMAC-SHA256`) y `Web Storage API` (`localStorage` y `sessionStorage`).

> **Nota de frontera arquitectónica:** El repositorio **no incluye servidor backend ni base de datos centralizada** (`AUSENTE`). Toda persistencia y verificación criptográfica ocurre en el navegador del cliente.

### 1.3 Stack Tecnológico Real Verificado
- **Lenguaje y módulos:** JavaScript ES Modules (`"type": "module"`).
- **Motor gráfico 3D:** Three.js `^0.186.1` sobre WebGL (`ACESFilmicToneMapping`, sombras `PCFSoftShadowMap`, modelos `.glb` + geometría procedural).
- **Audio:** Web Audio API procedural (`frontend/src/audio/audio.js`, sin archivos MP3/WAV externos).
- **Criptografía y Almacenamiento:** `window.crypto.subtle` (`PBKDF2`, `HMAC`, `SHA-256`), `localStorage` (`ideolo:v1:cuentas`, `ideolo:v1:intentos`, `calidad`) y `sessionStorage` (`ideolo:v1:sesion`).
- **Construcción y Pruebas:** Vite `^8.3.5` y Vitest `^5.1.0` (8 suites, 215 pruebas automatizadas).
- **Pipeline de Assets 3D:** Scripts de Blender en Python (`blender/crear_personajes.py`, `cara.py`, `convertir_mixamo.py`).

---

## 2. Actores del Sistema

El detalle de responsabilidades y evidencia en código se encuentra en `docs/requirements/use-cases.md`.

| ID | Actor | Clasificación | Estado | Evidencia Principal |
|---|---|---|---|---|
| **ACT-001** | **Jugador** | Primario humano | `IMPLEMENTADO` | `frontend/src/main.js`, `frontend/src/cuenta/pantalla.js`, `frontend/src/interfaz/tactil.js` |
| **ACT-002** | **Sistema de Juego** | Secundario lógico autónomo | `IMPLEMENTADO` | Loop `requestAnimationFrame` en `frontend/src/main.js:629-735` |
| **ACT-003** | **NPC / Daniel** | Secundario narrativo | `IMPLEMENTADO` | `frontend/src/personajes/daniel.js:11-56`, `frontend/src/juego/datos.js:23-61` |
| **ACT-004** | **Administrador / Desarrollador** | Operación y auditoría | `IMPLEMENTADO` (CLI/HTML) | `visor.html`, `niveles.html`, `pruebas.html`, `rendimiento.html`, Vitest CLI |
| **ACT-005** | **Servicio de Persistencia** | Técnico externo al gameplay | `IMPLEMENTADO` (Web Storage) | `frontend/src/cuenta/almacen.js:1-147` (`localStorage` / `sessionStorage`) |
| **ACT-006** | **Servicio de Autenticación** | Técnico condicional | `IMPLEMENTADO` (Local Client-Side) / `AUSENTE` (Servidor) | `frontend/src/cuenta/cuenta.js:1-244`, `frontend/src/cuenta/seguridad.js:1-151` |

---

## 3. Requisitos Funcionales (`RF`)

| ID | Requisito | Casos de Uso | Estado Real | Evidencia en Código (`frontend/src/`) | Criterio de Aceptación Verificado |
|---|---|---|---|---|---|
| **RF-001** | Inicializar motor WebGL, cargar modelos `.glb` y presentar pantalla de inicio/acceso o modo invitado sin bloqueo por pantalla negra. | `CU-001`, `CU-004` | `IMPLEMENTADO` | `main.js:18-48`, `main.js:182-227`, `cuenta/pantalla.js:9-192` | Captura de errores en `iniciar()` (`main.js:211-225`) con fallback visual; modo invitado funcional si `crypto.subtle` no está disponible. |
| **RF-002** | Controlar desplazamiento, rotación, salto, cámara orbital en 3.ª persona y soporte híbrido teclado/ratón y pantalla táctil. | `CU-005`, `CU-019` | `IMPLEMENTADO` | `main.js:76-152`, `main.js:465-527`, `juego/camara.js:1-92`, `interfaz/tactil.js:1-196` | Movimiento continuo con amortiguación exponencial, gravedad (`28 u/s²`), colisión cilindros (`r=0.45`) y auto-detección táctil. |
| **RF-003** | Generar y renderizar tres biomas diferenciados (Selva, Montaña Nevada, Desierto) con terreno matemático, agua/hielo, vegetación, cielo y nieve. | `CU-005`, `CU-013` | `IMPLEMENTADO` | `escenario/mundo.js:19-160`, `escenario/temas.js:3-98`, `escenario/terreno.js:3-19` | Cada nivel aplica su paleta, niebla, terreno (`alturaTerreno`), agua/hielo y partículas ambientales sin fugas bloqueantes. |
| **RF-004** | Guiar al jugador mediante el NPC Daniel, mostrando diálogos contextuales y actualizando el HUD de misión. | `CU-006`, `CU-007`, `CU-008`, `CU-019` | `IMPLEMENTADO` | `personajes/daniel.js:11-56`, `main.js:285-314`, `main.js:559-627`, `interfaz/hud.js:23-62` | Interacción con tecla `E` a `< 3.8 u`; avance de líneas y marcado visual `[✓]` de objetivos en `#objetivo`. |
| **RF-005** | Simular combate armado (cuchillo cuerpo a cuerpo y pistola con recarga), IA de persecución/disparo enemigo y daño anatómico por zonas. | `CU-009`, `CU-010`, `CU-011` | `IMPLEMENTADO` | `juego/combate.js:9-96`, `personajes/armas.js:6-90`, `personajes/enemigo.js:22-178` | Impactos en cabeza/pecho son letales (`mortal: true`); extremidades aplican daño parcial (`10-18 HP`) y vendajes visibles (`herir`). |
| **RF-006** | Gestionar supervivencia ambiental (frío en Nivel 2 y calor de fogata), recolección de suministros (armas y botiquines) y curación (`Q`). | `CU-010`, `CU-011` | `IMPLEMENTADO` | `juego/frio.js:1-14`, `juego/suministros.js:1-94`, `escenario/botiquines.js:1-86` | En Nivel 2, fuera del radio de calor (`9 u`), el frío sube (`0.085/s`) y drena salud al superar `0.7`; tecla `Q` restaura `+40 HP`. |
| **RF-007** | Ejecutar cinemática del ídolo al tomarlo en el altar, activar el portal de salida y transicionar entre los 3 niveles hasta la escena final en casa. | `CU-008`, `CU-012`, `CU-013`, `CU-014` | `IMPLEMENTADO` | `escenario/cinematica.js:1-161`, `escenario/portal.js:1-118`, `escenario/casa.js:1-125`, `main.js:316-413` | Al recoger el ídolo (`< 2.8 u`) con prerrequisitos cumplidos, se reproduce la cinemática (`6.5 s`), se abre el portal y el Nivel 3 culmina en `montarEscenaFinal`. |
| **RF-008** | Permitir pausar/reanudar (`ESC`), cambiar calidad gráfica (`F`) y reiniciar nivel o partida tras derrota/victoria (`R` / botones UI). | `CU-014`, `CU-015`, `CU-016` | `IMPLEMENTADO` | `main.js:91-99`, `main.js:354-441`, `juego/detalle.js:1-51` | Pausa detiene el delta de simulación y muestra `#pausa`; derrota muestra `#derrota` con causa exacta; victoria muestra estadísticas y récord. |
| **RF-009** | Registrar cuentas locales, autenticar sesiones y persistir el nivel desbloqueado, victorias y mejor tiempo por jugador. | `CU-002`, `CU-003`, `CU-017`, `CU-018` | `IMPLEMENTADO` (Local) | `cuenta/cuenta.js:70-231`, `cuenta/almacen.js:46-147` | El progreso persiste entre recargas del navegador y restaura el nivel máximo desbloqueado (`1..3`). |

---

## 4. Requisitos de Seguridad (`SEG`)

El análisis exhaustivo y modelo STRIDE se documentan en `docs/security/security-audit.md`.

| ID | Requisito de Seguridad | Casos de Uso | Estado Real | Evidencia en Código | Pruebas Automatizadas |
|---|---|---|---|---|---|
| **SEG-001** | Derivación de credenciales mediante `PBKDF2-SHA256` (`150 000` iteraciones, sal aleatoria de 16 bytes) y comparación en tiempo constante. | `CU-002`, `CU-003` | `IMPLEMENTADO` | `cuenta/seguridad.js:7-9`, `:63-112`, `:138-150` | `TC-SEC-001`, `TC-SEC-002` (`security-account.test.js`) |
| **SEG-002** | Firma de integridad de progreso con `HMAC-SHA256` sobre registro canónico `1\|nombre\|nivel\|mejorTiempo\|victorias`. | `CU-017`, `CU-018` | `IMPLEMENTADO` | `cuenta/seguridad.js:114-136`, `cuenta/cuenta.js:23-26`, `:141-162` | `TC-SEC-003` (`security-account.test.js`) |
| **SEG-003** | Saneamiento de entradas de usuario y validación estricta de esquema al deserializar `localStorage`. | `CU-002`, `CU-018` | `IMPLEMENTADO` | `cuenta/almacen.js:7-9`, `:19-44`, `cuenta/pantalla.js:9-192` | `TC-SEC-004`, `TC-SEC-005` (`security-account.test.js`) |
| **SEG-004** | Limitación de intentos fallidos de inicio de sesión (*rate limiting* local exponencial). | `CU-003` | `PARCIAL` (Local) | `cuenta/cuenta.js:52-68`, `cuenta/almacen.js:115-146` | `TC-SEC-006` (`security-account.test.js`) |
| **SEG-005** | Gestión de sesión local y aislamiento de clave de firma en `sessionStorage`. | `CU-003`, `CU-017` | `PARCIAL` (Riesgo documentado) | `cuenta/cuenta.js:28-31`, `cuenta/almacen.js:93-113` | `TC-SEC-005`, `TC-SEC-007` (`security-account.test.js`) |

---

## 5. Requisitos No Funcionales (`RNF`)

| ID | Categoría | Descripción y Métrica | Estado Real | Evidencia |
|---|---|---|---|---|
| **RNF-001** | **Rendimiento** | Mantener simulación estable (`dt = min(delta, 0.05)`) y ofrecer 3 perfiles de detalle (`bajo`, `medio`, `alto`) ajustando `pixelRatio`, sombras y partículas. | `IMPLEMENTADO` | `main.js:50-56`, `main.js:630`, `juego/detalle.js:1-51`, `herramientas/rendimiento.js` |
| **RNF-002** | **Mantenibilidad** | Separación modular por dominios (`cuenta/`, `escenario/`, `personajes/`, `juego/`, `interfaz/`, `audio/`, `herramientas/`) y diseño de FSM desacoplada lista para adopción controlada (`ADR-001`, `ADR-002`). | `IMPLEMENTADO` | Estructura `frontend/src/` + `juego/game-state-*.js` |
| **RNF-003** | **Testabilidad** | Ejecución determinista en entorno Node/Vitest mediante inyección de reloj/almacenamiento y pruebas de contrato para seguridad, dominio y máquina de estados. | `IMPLEMENTADO` | `frontend/tests/*.test.js` (8 suites, 215 tests en `< 2 s`) |
| **RNF-004** | **Compatibilidad y Usabilidad** | Diseño adaptable a escritorio y móviles/tablets (`responsivo.css`, `tactil.js`) y degradación elegante a modo invitado cuando `Web Crypto API` no está disponible. | `IMPLEMENTADO` | `interfaz/dispositivo.js`, `interfaz/tactil.js`, `cuenta/cuenta.js:76-81` |

---

## 6. Documentos Relacionados
- **Catálogo de Actores y Casos de Uso (`CU-001` a `CU-019`):** `docs/requirements/use-cases.md`
- **Matriz de Trazabilidad Completa:** `docs/requirements/traceability.md`
- **Arquitectura AS-IS y TO-BE (con 8 diagramas Mermaid):** `docs/architecture/current-architecture.md` y `docs/architecture/target-architecture.md`
- **Auditoría de Seguridad (`SEG-001` a `SEG-008`):** `docs/security/security-audit.md`
- **Estrategia, Casos y Resultados de Pruebas:** `docs/quality/test-strategy.md`, `docs/quality/test-cases.md`, `docs/quality/test-results.md`
