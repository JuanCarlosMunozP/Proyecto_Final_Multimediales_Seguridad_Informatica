# Lista de Verificación de Entrega, Limitaciones Conocidas y Guion de Sustentación Académica

**Proyecto:** La Búsqueda del Ídolo Perdido
**Fecha límite:** 7 de noviembre de 2026
**Rama:** `dev/jesus`
**Asignaturas:** Creación de Entornos Multimedia · Sistemas de Comunicación y Seguridad Informática

---

## 1. Verificación de los 14 Criterios de Finalización (Sección 11 del Prompt Maestro)

| # | Criterio de Finalización | Estado | Evidencia / Ubicación |
|---|---|---|---|
| 1 | El juego inicia sin errores críticos | **CUMPLIDO** | `frontend/src/main.js:182-227` con bloque `try/catch` de diagnóstico y modo invitado automático si `Web Crypto` no está disponible. |
| 2 | Los tres niveles son jugables o cuentan con diagnóstico documentado | **CUMPLIDO** | Niveles 1 (Selva), 2 (Montaña Nevada) y 3 (Desierto) verificados en `temas.js`, `mundo.js`, `datos.js` y `gameplay-domain.test.js`. |
| 3 | Las misiones pueden completarse | **CUMPLIDO** | Flujo completo Daniel → Suministros/Fogata → Ídolo → Portal verificado por `TC-DOM-001`. |
| 4 | Las transiciones funcionan | **CUMPLIDO** | Cinemática de playa, cinemática del ídolo, portales entre niveles y escena final en casa (`casa.js`). |
| 5 | El HUD refleja el estado real | **CUMPLIDO** | Salud, barra de frío, inventario de armas/munición/botiquines, objetivos `[✓]` y placa de cuenta activa (`interfaz/hud.js`). |
| 6 | La persistencia disponible funciona | **CUMPLIDO** | Cuentas y progreso persistidos en `localStorage` (`ideolo:v1:cuentas`) con firma `HMAC-SHA256` (`TC-SEC-003`, `TC-SEC-005`). |
| 7 | Los controles de seguridad están verificados | **CUMPLIDO** | `PBKDF2-SHA256` (`150 000` iteraciones), comparación en tiempo constante, `HMAC-SHA256`, bloqueo exponencial local y filtro XSS verificados en `security-account.test.js`. |
| 8 | Las pruebas automatizadas pasan | **CUMPLIDO** | **8 archivos de prueba, 215 tests aprobados (`0` fallos)** con `npm --prefix frontend test -- --run`. |
| 9 | El build de producción funciona | **CUMPLIDO** | `npm --prefix frontend run build` transforma 49 módulos en `528 ms` con código de salida `0`. |
| 10 | La arquitectura está documentada | **CUMPLIDO** | `docs/architecture/current-architecture.md` y `target-architecture.md`. |
| 11 | Los casos de uso y actores están completos | **CUMPLIDO** | `ACT-001` a `ACT-006` y `CU-001` a `CU-019` en `docs/requirements/use-cases.md`. |
| 12 | Los 8 diagramas Mermaid están generados | **CUMPLIDO** | Incluidos y validados en `docs/architecture/current-architecture.md` (Sección 4.1 a 4.8). |
| 13 | La matriz de trazabilidad está completa | **CUMPLIDO** | `docs/requirements/traceability.md`. |
| 14 | El proyecto puede explicarse y demostrarse en vivo | **CUMPLIDO** | Guion paso a paso incluido en la Sección 3 de este documento. |

---

## 2. Limitaciones Conocidas y Deuda Técnica Transparente

1. **Arquitectura 100 % Cliente (Sin Servidor Backend):**
   - La autenticación (`PBKDF2-SHA256`) y la firma de integridad (`HMAC-SHA256`) se ejecutan en el navegador sobre `localStorage` y `sessionStorage`. Protegen eficazmente contra exposición de contraseñas en texto plano y edición manual de `localStorage`, pero un usuario con acceso a DevTools en su propia máquina puede leer la clave de sesión en `sessionStorage` (`SEC-HIGH-01`) o borrar la clave de bloqueo `ideolo:v1:intentos` (`SEC-MED-01`).
2. **Subsistema FSM (`FSM-002` a `FSM-010`) en Aislamiento Controlado:**
   - Los módulos `game-state-machine.js`, `game-state-coordinator.js` y `game-state-adapters.js` están implementados y cubiertos por 204 pruebas unitarias, pero se mantienen desacoplados de `main.js` hasta autorización humana expresa.
3. **Defectos Multimedia Identificados Pendientes de Aprobación de Parche (`[MM-P0-01]` a `[MM-P1-01]`):**
   - Las balas aún no colisionan con los cilindros de `mundo.obstaculos`, y el diálogo/transición de nivel en `main.js` requiere el parche mínimo de sincronización propuesto en `docs/architecture/target-architecture.md`.

---

## 3. Guion de Exposición y Demostración en Vivo (10–12 Minutos)

### Parte 1 — Introducción y Arquitectura Computacional (2 min)
1. Mostrar el diagrama de componentes (`docs/architecture/current-architecture.md`) explicando cómo el proyecto une **Creación de Entornos Multimedia** (Three.js, WebGL, modelos `.glb` generados en Blender, terrenos matemáticos y síntesis Web Audio) con **Seguridad Informática** (`Web Crypto API` y validación de integridad).
2. Destacar la honestidad arquitectónica: distinguir qué está implementado hoy en el cliente (`AS-IS`) y cómo se proyecta la capa de servidor (`TO-BE`).

### Parte 2 — Demostración de Seguridad Informática en Vivo (3 min)
1. Abrir el juego (`npm --prefix frontend run dev` → `http://localhost:5173`).
2. **Registro y Derivación Criptográfica (`CU-002`, `SEG-001`):**
   - Hacer clic en **Cuenta** y crear un usuario (ej. `Profesor_01`).
   - Abrir **Chrome DevTools → Application → Local Storage** y mostrar la clave `ideolo:v1:cuentas`: evidenciar que la contraseña no existe en texto plano; mostrar `iteraciones: 150000`, `sal` aleatoria, `verificador` (`PBKDF2-SHA256`) y `firma` (`HMAC-SHA256`).
3. **Demostración de Detección de Manipulación (`Tampering` — `SEG-003`):**
   - En DevTools (`localStorage`), editar manualmente el JSON de `Profesor_01` cambiando `"nivel": 1` por `"nivel": 3` y recargar la página (`F5`).
   - Mostrar cómo el sistema detecta que la firma `HMAC-SHA256` es inválida, **restablece automáticamente la cuenta al Nivel 1** y muestra la alerta defensiva.
4. **Bloqueo por Fuerza Bruta (`SEG-004`):**
   - Cerrar sesión e introducir 3 contraseñas erróneas seguidas; mostrar el bloqueo temporal exponencial.

### Parte 3 — Demostración Multimedia y Gameplay en los 3 Niveles (4 min)
1. **Nivel 1 — Selva Tropical (`CU-005` a `CU-009`):**
   - Mostrar la cinemática de llegada en lancha a la playa (`cinematicaPlaya.js`).
   - Hablar con **Daniel** (`E`), recoger el arma cerca de las cajas, combatir un mercenario (mostrando impactos por zona corporal y vendajes en `personaje.js`), tomar el **Ídolo de Oro** en el altar (cinemática orbital con partículas) y cruzar el portal.
2. **Nivel 2 — Montaña Nevada (`RF-006`):**
   - Mostrar la barra de **Frío** subiendo con la tormenta de nieve (`nieve.js`) y cómo disminuye al acercarse a la fogata del campamento (`frio.js`).
3. **Nivel 3 — Desierto y Escena Final (`CU-014`):**
   - Mostrar el bioma desértico (dunas, cactus, palmeras) o usar el visor de niveles (`http://localhost:5173/niveles.html`) y el visor de modelos (`http://localhost:5173/visor.html`) para inspeccionar los modelos 3D y la escena final en casa con los 3 ídolos sobre la mesa.

### Parte 4 — Evidencia DevSecOps y Pruebas Automatizadas (2 min)
1. Abrir `http://localhost:5173/pruebas.html` para mostrar las pruebas de integración WebGL en el navegador.
2. Ejecutar en terminal `npm --prefix frontend test -- --run` y `npm --prefix frontend run build`, mostrando las **215 pruebas automatizadas pasando en `< 2 s`**.
