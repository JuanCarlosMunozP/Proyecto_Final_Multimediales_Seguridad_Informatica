# SRS — Especificación de Requisitos de Software: «La Búsqueda del Ídolo Perdido»

**Versión:** 1.0 (Consolidada para Entrega Académica)
**Estado:** Actualizado contra la integración cliente-servidor
**Asignaturas integradas:** Creación de Entornos Multimedia · Sistemas de Comunicación y Seguridad Informática

---

## 1. Introducción

### 1.1 Propósito
Definir y verificar formalmente los requisitos funcionales (`RF`), de seguridad (`SEG`) y no funcionales (`RNF`) del videojuego 3D interactivo **«La Búsqueda del Ídolo Perdido»**, vinculando cada requisito con su implementación real en `frontend/` o `backend/`, su caso de uso (`CU-001` a `CU-019`) y su evidencia de prueba automatizada.

### 1.2 Alcance del Sistema (AS-IS)
Aplicación web 3D interactiva en tercera persona. El frontend ejecuta el juego y la interfaz; el backend FastAPI gestiona registro, autenticación, sesiones y persistencia de progreso en PostgreSQL. Las solicitudes del cliente usan cookies HttpOnly y protección CSRF. El modo invitado permite jugar sin guardar progreso.

### 1.3 Stack Tecnológico Real Verificado
- **Lenguaje y módulos:** JavaScript ES Modules (`"type": "module"`).
- **Motor gráfico 3D:** Three.js `^0.186.1` sobre WebGL (`ACESFilmicToneMapping`, sombras `PCFSoftShadowMap`, modelos `.glb` + geometría procedural).
- **Audio:** Web Audio API procedural (`frontend/src/audio/audio.js`, sin archivos MP3/WAV externos).
- **Backend y Persistencia:** FastAPI, SQLAlchemy, Alembic y PostgreSQL; Argon2id para contraseñas y HMAC-SHA256 para integridad de progreso.
- **Seguridad de sesión:** Cookie HttpOnly y token CSRF; el frontend no almacena credenciales ni progreso en Web Storage.
- **Construcción y Pruebas:** Vite `^8.3.5` y Vitest `^5.1.0` (12 suites, 246 pruebas automatizadas).
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
| **ACT-005** | **Servicio de Persistencia** | Técnico externo al gameplay | `IMPLEMENTADO` (PostgreSQL) | `backend/app/infrastructure/models.py`, `backend/app/infrastructure/repositories.py` |
| **ACT-006** | **Servicio de Autenticación** | Técnico externo al gameplay | `IMPLEMENTADO` (FastAPI) | `backend/app/application/use_cases.py`, `backend/app/presentation/routers.py` |

---

## 3. Requisitos Funcionales (`RF`)

| ID | Requisito | Casos de Uso | Estado Real | Evidencia en Código (`frontend/src/`) | Criterio de Aceptación Verificado |
|---|---|---|---|---|---|
| **RF-001** | Inicializar motor WebGL, cargar modelos `.glb` y presentar pantalla de inicio/acceso o modo invitado sin bloqueo por pantalla negra. | `CU-001`, `CU-004` | `IMPLEMENTADO` | `main.js`, `cuenta/pantalla.js` | Captura de errores en `iniciar()` con fallback visual; modo invitado disponible sin depender de Web Crypto. |
| **RF-002** | Controlar desplazamiento, rotación, salto, cámara orbital en 3.ª persona y soporte híbrido teclado/ratón y pantalla táctil. | `CU-005`, `CU-019` | `IMPLEMENTADO` | `main.js:76-152`, `main.js:465-527`, `juego/camara.js:1-92`, `interfaz/tactil.js:1-196` | Movimiento continuo con amortiguación exponencial, gravedad (`28 u/s²`), colisión cilindros (`r=0.45`) y auto-detección táctil. |
| **RF-003** | Generar y renderizar tres biomas diferenciados (Selva, Montaña Nevada, Desierto) con terreno matemático, agua/hielo, vegetación, cielo y nieve. | `CU-005`, `CU-013` | `IMPLEMENTADO` | `escenario/mundo.js:19-160`, `escenario/temas.js:3-98`, `escenario/terreno.js:3-19` | Cada nivel aplica su paleta, niebla, terreno (`alturaTerreno`), agua/hielo y partículas ambientales sin fugas bloqueantes. |
| **RF-004** | Guiar al jugador mediante el NPC Daniel, mostrando diálogos contextuales y actualizando el HUD de misión. | `CU-006`, `CU-007`, `CU-008`, `CU-019` | `IMPLEMENTADO` | `personajes/daniel.js:11-56`, `main.js:285-314`, `main.js:559-627`, `interfaz/hud.js:23-62` | Interacción con tecla `E` a `< 3.8 u`; avance de líneas y marcado visual `[✓]` de objetivos en `#objetivo`. |
| **RF-005** | Simular combate armado (cuchillo cuerpo a cuerpo y pistola con recarga), IA de persecución/disparo enemigo y daño anatómico por zonas. | `CU-009`, `CU-010`, `CU-011` | `IMPLEMENTADO` | `juego/combate.js:9-96`, `personajes/armas.js:6-90`, `personajes/enemigo.js:22-178` | Impactos en cabeza/pecho son letales (`mortal: true`); extremidades aplican daño parcial (`10-18 HP`) y vendajes visibles (`herir`). |
| **RF-006** | Gestionar supervivencia ambiental (frío en Nivel 2 y calor de fogata), recolección de suministros (armas y botiquines) y curación (`Q`). | `CU-010`, `CU-011` | `IMPLEMENTADO` | `juego/frio.js:1-14`, `juego/suministros.js:1-94`, `escenario/botiquines.js:1-86` | En Nivel 2, fuera del radio de calor (`9 u`), el frío sube (`0.085/s`) y drena salud al superar `0.7`; tecla `Q` restaura `+40 HP`. |
| **RF-007** | Ejecutar cinemática del ídolo al tomarlo en el altar, activar el portal de salida y transicionar entre los 3 niveles hasta la escena final en casa. | `CU-008`, `CU-012`, `CU-013`, `CU-014` | `IMPLEMENTADO` | `escenario/cinematica.js:1-161`, `escenario/portal.js:1-118`, `escenario/casa.js:1-125`, `main.js:316-413` | Al recoger el ídolo (`< 2.8 u`) con prerrequisitos cumplidos, se reproduce la cinemática (`6.5 s`), se abre el portal y el Nivel 3 culmina en `montarEscenaFinal`. |
| **RF-008** | Permitir pausar/reanudar (`ESC`), cambiar calidad gráfica (`F`) y reiniciar nivel o partida tras derrota/victoria (`R` / botones UI). | `CU-014`, `CU-015`, `CU-016` | `IMPLEMENTADO` | `main.js:91-99`, `main.js:354-441`, `juego/detalle.js:1-51` | Pausa detiene el delta de simulación y muestra `#pausa`; derrota muestra `#derrota` con causa exacta; victoria muestra estadísticas y récord. |
| **RF-009** | Registrar cuentas, autenticar sesiones y persistir el nivel desbloqueado, victorias y mejor tiempo por jugador. | `CU-002`, `CU-003`, `CU-016` | `IMPLEMENTADO` (Backend) | `frontend/src/cuenta/apiCliente.js`, `backend/app/presentation/routers.py`, `backend/app/application/use_cases.py` | El backend persiste el progreso y lo recupera tras recargar mediante la sesión autenticada. |

---

## 4. Requisitos de Seguridad (`SEG`)

El análisis exhaustivo y modelo STRIDE se documentan en `docs/security/security-audit.md`.

| ID | Requisito de Seguridad | Casos de Uso | Estado Real | Evidencia en Código | Pruebas Automatizadas |
|---|---|---|---|---|---|
| **SEG-001** | Hash de contraseñas mediante Argon2id. | `CU-002`, `CU-003` | `IMPLEMENTADO` | `backend/app/core/security.py`, `backend/app/application/use_cases.py` | `backend/tests/test_clean_architecture_and_security.py` |
| **SEG-002** | Firma de integridad de progreso con HMAC-SHA256 del lado servidor. | `CU-016` | `IMPLEMENTADO` | `backend/app/core/security.py`, `backend/app/application/use_cases.py` | `backend/tests/test_clean_architecture_and_security.py` |
| **SEG-003** | Validación de entradas en el backend y prevención de XSS en la interfaz DOM. | `CU-002`, `CU-003` | `IMPLEMENTADO` | `backend/app/domain/entities/user.py`, `backend/app/presentation/schemas.py`, `frontend/src/cuenta/pantalla.js` | `backend/tests/test_clean_architecture_and_security.py`, `frontend/tests/account-api.test.js` |
| **SEG-004** | Limitación de intentos fallidos de inicio de sesión gestionada por el backend. | `CU-003` | `IMPLEMENTADO` | `backend/app/application/use_cases.py`, `backend/app/domain/entities/user.py` | `backend/tests/test_clean_architecture_and_security.py` |
| **SEG-005** | Sesiones revocables en cookie HttpOnly y protección CSRF. | `CU-003` | `IMPLEMENTADO` | `backend/app/presentation/routers.py`, `backend/app/presentation/dependencies.py` | `backend/tests/test_clean_architecture_and_security.py`, `frontend/tests/account-api.test.js` |

---

## 5. Requisitos No Funcionales (`RNF`)

| ID | Categoría | Descripción y Métrica | Estado Real | Evidencia |
|---|---|---|---|---|
| **RNF-001** | **Rendimiento** | Mantener simulación estable (`dt = min(delta, 0.05)`) y ofrecer 3 perfiles de detalle (`bajo`, `medio`, `alto`) ajustando `pixelRatio`, sombras y partículas. | `IMPLEMENTADO` | `main.js:50-56`, `main.js:630`, `juego/detalle.js:1-51`, `herramientas/rendimiento.js` |
| **RNF-002** | **Mantenibilidad** | Separación modular por dominios (`cuenta/`, `escenario/`, `personajes/`, `juego/`, `interfaz/`, `audio/`, `herramientas/`) y diseño de FSM desacoplada lista para adopción controlada (`ADR-001`, `ADR-002`). | `IMPLEMENTADO` | Estructura `frontend/src/` + `juego/game-state-*.js` |
| **RNF-003** | **Testabilidad** | Ejecución determinista en Vitest y pruebas backend para seguridad, dominio, API y máquina de estados. | `IMPLEMENTADO` | `frontend/tests/*.test.js` (12 suites, 246 pruebas); `backend/tests/` |
| **RNF-004** | **Compatibilidad y Usabilidad** | Diseño adaptable a escritorio y móviles/tablets (`responsivo.css`, `tactil.js`) y modo invitado sin dependencia de Web Crypto. | `IMPLEMENTADO` | `interfaz/dispositivo.js`, `interfaz/tactil.js`, `cuenta/pantalla.js` |

---

## 6. Documentos Relacionados
- **Catálogo de Actores y Casos de Uso (`CU-001` a `CU-019`):** `docs/requirements/use-cases.md`
- **Matriz de Trazabilidad Completa:** `docs/requirements/traceability.md`
- **Arquitectura AS-IS y TO-BE (con 8 diagramas Mermaid):** `docs/architecture/current-architecture.md` y `docs/architecture/target-architecture.md`
- **Auditoría de Seguridad (`SEG-001` a `SEG-008`):** `docs/security/security-audit.md`
- **Estrategia, Casos y Resultados de Pruebas:** `docs/quality/test-strategy.md`, `docs/quality/test-cases.md`, `docs/quality/test-results.md`
