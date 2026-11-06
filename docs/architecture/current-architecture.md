# Arquitectura actual — AS-IS

**Proyecto:** La Búsqueda del Ídolo Perdido
**Versión:** 0.1
**Estado:** Borrador técnico
**Commit analizado:** e7d717c
**Rama:** dev/jesus

## 1. Propósito

Documentar la arquitectura existente antes
de introducir refactorizaciones.

## 2. Contexto del sistema

La aplicación es un videojuego 3D ejecutado
en un navegador mediante JavaScript,
Three.js, WebGL y Web Audio.

El sistema actual utiliza almacenamiento
local del navegador para cuentas y progreso.

No se ha identificado un backend de
autenticación centralizada.

## 3. Componentes identificados

| Componente | Responsabilidad |
|---|---|
| main.js | Coordinación e inicialización |
| escenario/ | Construcción de mundos y biomas |
| personajes/ | Modelos, enemigos y animaciones |
| juego/ | Cámara, combate y objetivos |
| interfaz/ | HUD y controles |
| audio/ | Sonido y ambientación |
| cuenta/ | Identidad local y progreso |
| herramientas/ | Visores, pruebas y diagnóstico |

## 4. Dependencias verificadas

- main.js importa personaje.js.
- main.js importa módulos de escenario/.
- main.js importa módulos de juego/.
- main.js importa módulos de interfaz/.
- main.js importa cuenta/cuenta.js.
- main.js importa audio/audio.js.
- personaje.js importa poses.js.
- enemigo.js importa personaje.js.
- cuenta.js utiliza seguridad.js.
- cuenta.js utiliza almacen.js.

## 5. Hallazgos arquitectónicos

### ARQ-001 Coordinación centralizada
main.js concentra múltiples responsabilidades.
Requiere análisis previo a su refactorización.

### ARQ-002 Archivo alternativo de personaje
personaje.nuevo.js no presenta referencias
en las importaciones inspeccionadas.
Pendiente verificar uso dinámico y diferencias.

### ARQ-003 Separación parcial existente
El sistema ya está organizado por módulos.
Debemos conservar los límites que funcionan.

## 6. Hallazgos de seguridad

### SEC-001 Persistencia local
Las cuentas utilizan localStorage.

### SEC-002 Gestión de sesión
La sesión utiliza sessionStorage y una
clave derivada de la contraseña.

Requiere análisis de amenazas y revisión
de la exposición de material criptográfico.

## 7. Restricciones de refactorización

- Mantener el comportamiento del videojuego.
- No eliminar módulos sin evidencias.
- Crear pruebas antes de modificar reglas.
- Evitar dependencias circulares.
- No introducir backend sin requisito aprobado.
- Registrar decisiones mediante ADR.

## 8. Pendientes

- Diagrama C4 de contexto.
- Diagrama C4 de componentes.
- Grafo completo de dependencias.
- Modelo de amenazas STRIDE.
- Revisión de las pruebas existentes.
- Análisis de responsabilidades de main.js.

## 9. Aprobación

Pendiente de revisión técnica.
