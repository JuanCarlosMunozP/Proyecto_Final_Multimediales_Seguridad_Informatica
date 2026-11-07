# Estrategia Integral de Pruebas (QA & DevSecOps)

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 1.0
**Marco de Ejecución:** Vitest `^5.1.0` (CLI Node) + Suite Interactiva en Navegador (`/pruebas.html`) + Verificación de Build Vite `^8.3.5`

---

## 1. Objetivos de Calidad

Garantizar con evidencia reproducible que tanto los subsistemas de **Creación de Entornos Multimedia** (físicas 2.5D, terreno, combate anatómico, misiones, supervivencia al frío y máquina de estados) como los de **Seguridad Informática** (`PBKDF2-SHA256`, `HMAC-SHA256`, validación de esquemas en `localStorage`, sesiones y resistencia a fuerza bruta) funcionan conforme a la especificación (`docs/requirements/SRS.md`).

---

## 2. Niveles y Tipos de Prueba Separados

### 2.1 Pruebas Unitarias Puras (`frontend/tests/*.test.js`)
Evalúan funciones y clases deterministas sin dependencias de red ni contexto WebGL nativo:
- **Máquina de Estados Formal (`game-state-machine.test.js`):** 9 estados, transiciones válidas/inválidas, historial acotado y política de precedencia `POL-FSM-001`.
- **Coordinador de Estados (`game-state-coordinator.test.js`):** Candados de exclusión mutua (`transitionLock`, `levelChangePending`, `defeatPending`).
- **Dominio de Juego (`gameplay-domain.test.js`):** Progresión de misiones en los 3 niveles (`datos.js`), cálculo de enfriamiento y daño por hipotermia (`frio.js`), zonas anatómicas de impacto de bala (`armas.js`) y funciones matemáticas de altura de terreno/agua (`terreno.js`, `temas.js`).

### 2.2 Pruebas de Integración Simulada y Adaptadores (`frontend/tests/game-state-*-integration.test.js`)
Verifican la interacción entre los adaptadores de diálogo, cinemática del ídolo, transición de nivel y desenlace terminal (`derrota` / `victoria`) frente a eventos concurrentes simulados (como daño letal durante un fade-out de cambio de nivel).

### 2.3 Pruebas de Seguridad e Integridad Criptográfica (`frontend/tests/security-account.test.js`)
Ejecutan las primitivas reales de `Web Crypto API` (`crypto.subtle`) y almacenamiento simulado en memoria para verificar:
- Derivación `PBKDF2-SHA256` (`150 000` iteraciones) con separación de verificador y clave HMAC.
- Comparación en tiempo constante `iguales(a, b)`.
- Firma y detección de adulteración (`tampering`) con `HMAC-SHA256` y restablecimiento automático al Nivel 1.
- Saneamiento de esquemas JSON corruptos y rechazo de payloads XSS en nombres de cuenta.
- Bloqueo exponencial ante múltiples intentos fallidos de inicio de sesión.

### 2.4 Pruebas de Diagnóstico Visual y WebGL en Navegador (`frontend/pruebas.html`)
El proyecto incluye un arnés de pruebas en navegador (`frontend/src/herramientas/pruebas.js`) accesible en `http://localhost:5173/pruebas.html` que ejecuta más de **40 aserciones en vivo** con contexto WebGL y modelos `.glb` reales (verificación de articulaciones de personajes, animación de muerte, creación/destrucción de los 3 biomas, colisión con obstáculos, cámara y efectos de sonido).

### 2.5 Pruebas de Construcción y Empaquetado (`npm run build`)
Validan que todos los módulos ES, hojas de estilo y referencias estáticas compilen sin errores de sintaxis ni importaciones circulares rotas mediante Vite `^8.3.5`.

---

## 3. Comandos de Ejecución Reproducible

Desde la raíz del repositorio (`C:\Estudio\Seguridad-Multimedia`):

```powershell
# 1. Ejecutar las 8 suites automatizadas (215 pruebas) en modo no interactivo
npm --prefix frontend test -- --run

# 2. Verificar el empaquetado de producción con Vite
npm --prefix frontend run build

# 3. (Opcional) Iniciar servidor de desarrollo para pruebas visuales en navegador (/pruebas.html, /visor.html, /niveles.html, /rendimiento.html)
npm --prefix frontend run dev
```
