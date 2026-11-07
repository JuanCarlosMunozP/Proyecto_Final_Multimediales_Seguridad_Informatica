# Auditoría de Seguridad Informática y Modelo de Amenazas (`SEG-001` a `SEG-008`)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Asignatura:** Sistemas de Comunicación y Seguridad Informática
**Versión:** 1.0
**Rama / Commit auditado:** `dev/jesus` (`8bdba73`)
**Alcance:** Evaluación forense real de los controles criptográficos, gestión de identidad local (IAM), protección de persistencia, superficie DOM/XSS, dependencias y postura DevSecOps del repositorio.

---

## 1. Premisa Arquitectónica y Frontera de Confianza

> **Declaración de honestidad técnica:** El repositorio auditado es una aplicación **100 % ejecutada en el navegador del cliente** (*Client-Side WebGL SPA*) sin backend de servidor ni base de datos remota (`AUSENTE`).

En consecuencia:
1. **Amenazas mitigadas eficazmente por el sistema actual:** Lectura de contraseñas en texto plano en almacenamiento local, ataques de temporización (*timing attacks*) en comparación de hashes, manipulación casual o accidental del nivel desbloqueado y récords en `localStorage`, inyección de código HTML/JS (*DOM XSS*) a través de nombres de usuario, y corrupción de estructuras JSON persistidas.
2. **Limitación estructural del modelo solo-cliente:** Dado que el navegador del usuario controla el entorno de ejecución (DevTools, memoria JS, `localStorage` y `sessionStorage`), un atacante con acceso físico o ejecución de consola en su propio navegador puede modificar variables en memoria o extraer la clave de sesión activa de `sessionStorage`. La única mitigación definitiva para un entorno competitivo multiusuario es migrar la verificación de autoridad a un servidor remoto (documentado en `docs/architecture/target-architecture.md`).

---

## 2. Evaluación Detallada de los Dominios `SEG-001` a `SEG-008`

### `SEG-001` — Criptografía y Protección de Credenciales
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en código:** `frontend/src/cuenta/seguridad.js:1-151`
- **Mecanismos verificados:**
  1. **Generación de sal criptográfica (`seguridad.js:58-61`):** Utiliza `crypto.getRandomValues(new Uint8Array(16))` (128 bits de entropía por cuenta).
  2. **Derivación de clave (`seguridad.js:63-112`):** Utiliza `window.crypto.subtle.deriveBits` con algoritmo **`PBKDF2`**, hash **`SHA-256`** y **`150 000` iteraciones** (`ITERACIONES = 150_000`), superando las recomendaciones base de OWASP para PBKDF2-SHA256 en entornos web.
  3. **Separación de material criptográfico (`seguridad.js:100-111`):** Deriva `512 bits` (`64 bytes`) en una sola operación y los divide en dos mitades criptográficamente independientes:
     - **Primeros 256 bits (`verificador`):** Persistidos en `localStorage` para validar futuras autenticaciones.
     - **Segundos 256 bits (`clave`):** Utilizados exclusivamente como llave secreta para firmar el progreso con `HMAC-SHA256`; **nunca se guarda en `localStorage`**.
  4. **Comparación en tiempo constante (`seguridad.js:138-150`):** La función `iguales(a, b)` realiza una comparación XOR byte a byte (`diff |= a.charCodeAt(i) ^ b.charCodeAt(i)`) evitando fugas por canal lateral de tiempo.
- **Pruebas automatizadas:** `TC-SEC-001`, `TC-SEC-002` en `frontend/tests/security-account.test.js`.

---

### `SEG-002` — Gestión de Identidad, Autenticación y Sesiones (IAM Local)
- **Estado:** **`IMPLEMENTADO` (Local Client-Side)**
- **Evidencia en código:** `frontend/src/cuenta/cuenta.js:1-244`, `frontend/src/cuenta/pantalla.js:1-232`
- **Mecanismos verificados:**
  1. **Política de nombres de usuario (`almacen.js:8`):** Expresión regular estricta `/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]{3,16}$/` e unicidad insensible a mayúsculas (`idCuenta`).
  2. **Política de contraseñas (`cuenta.js:3-4`, `:37-43`):** Longitud entre `6` y `64` caracteres.
  3. **Control de fuerza bruta local (`cuenta.js:5-7`, `:52-68`, `almacen.js:115-146`):** Tras `3` intentos fallidos (`MAX_INTENTOS = 3`), aplica un bloqueo exponencial:
     $$\text{Bloqueo}(n) = \min\left(300\,000\text{ ms},\; 15\,000 \times 2^{\max(0,\, n - 3)}\text{ ms}\right)$$
  4. **Mensajes de error genéricos (`cuenta.js:126`, `:138`):** Ante usuario inexistente o contraseña errónea en login, responde con el mismo mensaje (`"Nombre o contraseña incorrectos."`) para dificultar la enumeración de cuentas desde la interfaz.
  5. **Modo invitado explícito (`cuenta.js:169-174`):** Permite jugar sin cuenta (`invitado: true`) informando claramente que el progreso no se guardará.
- **Pruebas automatizadas:** `TC-SEC-005`, `TC-SEC-006`, `TC-SEC-007` en `frontend/tests/security-account.test.js`.

---

### `SEG-003` — Integridad de Persistencia y Protección contra Manipulación (`Tampering`)
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en código:** `frontend/src/cuenta/seguridad.js:114-136`, `frontend/src/cuenta/cuenta.js:23-26`, `:141-162`, `:203-231`
- **Mecanismos verificados:**
  1. **Firma `HMAC-SHA256` del progreso (`cuenta.js:23-26`):** El progreso se serializa en formato canónico determinista:
     $$\text{textoProgreso} = \texttt{"1|"} \parallel \text{idCuenta} \parallel \texttt{"|"} \parallel \text{nivel} \parallel \texttt{"|"} \parallel \text{mejorTiempo} \parallel \texttt{"|"} \parallel \text{victorias}$$
     y se firma con `crypto.subtle.sign("HMAC", clave, bytes)`.
  2. **Detección y autorrecuperación ante adulteración (`cuenta.js:141-162`, `:192-198`):** Si un usuario edita `localStorage` para cambiar `"nivel": 1` a `"nivel": 3`, al iniciar sesión o cargar progreso `verificarFirma` devuelve `false`, el sistema **restablece automáticamente el progreso a Nivel 1 (`{ nivel: 1, mejorTiempo: 0, victorias: 0 }`)**, vuelve a firmar y notifica al jugador: *"Se detectó una modificación externa del progreso; se restableció al nivel 1."*
  3. **Validación estructural de esquema (`almacen.js:19-44`):** `cuentaValida(c)` verifica tipos, longitudes máximas (`<= 512`), rangos (`nivel` en `1..3`) y descarta silenciosamente entradas corruptas al leer `localStorage`.
- **Pruebas automatizadas:** `TC-SEC-003`, `TC-SEC-004` en `frontend/tests/security-account.test.js`.

---

### `SEG-004` — Seguridad en el Frontend, DOM y Prevención de XSS
- **Estado:** **`PARCIAL` (Seguro en entrada de usuario; uso acotado de `innerHTML` en HUD estático)**
- **Evidencia en código:** `frontend/src/cuenta/pantalla.js:9-192`, `frontend/src/interfaz/hud.js:47-70`, `frontend/src/main.js:217`
- **Hallazgos:**
  1. **Módulo de cuentas 100 % libre de `innerHTML` (`pantalla.js:9-23`):** La función `el(tag, attrs, hijos)` construye nodos mediante `document.createElement` y `textContent`. El nombre del jugador nunca se interpola en HTML crudo.
  2. **Uso de `innerHTML` con datos estáticos (`hud.js:55`, `:69`, `main.js:217`):** `hud.js` utiliza `innerHTML` para renderizar la lista de objetivos de misión (`datos.js`) y `main.js:217` para el mensaje de error de carga (`err.message`). Aunque ninguna de estas rutas recibe entrada directa del usuario, se recomienda reemplazarlas por construcción DOM segura o saneamiento explícito como medida de defensa en profundidad.

---

### `SEG-005` — Seguridad de API y Comunicaciones
- **Estado:** **`NO APLICABLE` en AS-IS (Sin API Backend) / `IMPLEMENTADO` para Requisitos de Contexto Seguro Web Crypto**
- **Evidencia en código:** `frontend/src/cuenta/seguridad.js:11-17`, `frontend/src/cuenta/cuenta.js:76-81`
- **Análisis:** La aplicación no realiza llamadas `fetch`/`XMLHttpRequest` a servidores externos; todos los recursos (`.glb`, scripts, estilos) se sirven desde el mismo origen (`same-origin`). Además, `seguridad.disponible()` verifica la presencia de `window.crypto.subtle` (que los navegadores solo exponen en **Contextos Seguros**: `https://` o `http://localhost`), degradando de forma segura a modo invitado si se abre en un origen inseguro.

---

### `SEG-006` — Hardening de Servidor y Cabeceras HTTP
- **Estado:** **`AUSENTE` en Repositorio (Configuración dependiente del servidor de despliegue)**
- **Análisis:** El repositorio contiene únicamente el proyecto frontend Vite (`frontend/package.json`). No incluye archivos `nginx.conf`, `Dockerfile` ni cabeceras HTTP de producción.
- **Recomendación lista para despliegue (Documentada en sección 4):** Configuración de cabeceras `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`.

---

### `SEG-007` — Auditoría de Dependencias y Cadena de Suministro (DevSecOps)
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en repositorio:** `frontend/package.json`, `frontend/package-lock.json`, `docs/engineering/baseline.md:24-25`
- **Resultados verificados:**
  - Dependencias de producción: **1 sola dependencia** (`three: ^0.186.1`).
  - Dependencias de desarrollo: **2 paquetes directos** (`vite: ^8.3.5`, `vitest: ^5.1.0`), totalizando apenas **17 paquetes** en `package-lock.json`.
  - Superficie de ataque de cadena de suministro extremadamente reducida y sin vulnerabilidades conocidas en la línea base (`0 vulnerabilities`).

---

### `SEG-008` — Registro de Eventos, Manejo de Errores y No Exposición de Secretos
- **Estado:** **`IMPLEMENTADO`**
- **Evidencia en código:** `frontend/src/cuenta/almacen.js:11-17`, `frontend/src/main.js:211-225`
- **Mecanismos verificados:**
  - `leerJSON` captura excepciones de `JSON.parse` y `localStorage` bloqueado (modo incógnito estricto) sin exponer trazas ni bloquear el hilo principal.
  - Ningún módulo registra contraseñas, sales ni claves derivadas en `console.log` o `console.error`.

---

## 3. Matriz de Amenazas STRIDE y Hallazgos Priorizados

| ID Hallazgo | Categoría STRIDE | Severidad | Descripción y Ubicación Exacta | Estado / Mitigación |
|---|---|---|---|---|
| **SEC-HIGH-01** | *Information Disclosure / Elevation of Privilege* | **Alta (Arquitectónica Local)** | `frontend/src/cuenta/cuenta.js:28-31` y `almacen.js:93-113` almacenan `{ nombre, clave }` (con la llave HMAC en Base64) en `sessionStorage` (`ideolo:v1:sesion`) para mantener la sesión activa tras `location.reload()` (`main.js:206`). Quien ejecute JS en la pestaña o inspeccione `sessionStorage` puede leer `clave` y firmar cualquier progreso en `localStorage`. | **Documentado (`ADR-002` / Riesgo Aceptado en Cliente Puro):** Mitigación a corto plazo: mantener `clave` solo en memoria RAM y cambiar cuenta sin `location.reload()`, o usar clave `CryptoKey` no exportable en `IndexedDB`. |
| **SEC-MED-01** | *Tampering / Brute Force Bypass* | **Media (Arquitectónica Local)** | `frontend/src/cuenta/almacen.js:115-146` guarda el contador de fallos y bloqueo temporal en `localStorage` (`ideolo:v1:intentos`). Un atacante local puede borrar esa clave desde DevTools para reiniciar el contador de intentos. | **Documentado:** Inherente a aplicaciones sin backend; aun borrando `ideolo:v1:intentos`, cada intento requiere `150 000` iteraciones de `PBKDF2-SHA256`. |
| **SEC-LOW-01** | *Tampering / DOM XSS* | **Baja** | `frontend/src/interfaz/hud.js:55`, `:69` y `main.js:217` usan `innerHTML` para objetivos de misión y mensaje de fallo de carga. Actualmente seguro porque `datos.js` es estático, pero riesgoso si en el futuro se interpola el nombre del jugador en objetivos. | **Recomendado:** Sustituir `innerHTML` por `createElement` / `textContent`. |

---

## 4. Configuración Recomendada de Cabeceras HTTP de Seguridad (Para Despliegue Estático / Nginx)

Cuando el build de producción (`frontend/dist/`) se publique en un servidor web o CDN, se recomienda aplicar la siguiente política de cabeceras HTTP:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```
