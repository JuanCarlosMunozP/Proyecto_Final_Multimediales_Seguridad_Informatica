# SRS — La Búsqueda del Ídolo Perdido

**Versión:** 0.1
**Estado:** Borrador
**Clasificación:** Documento de ingeniería
**Referencia inicial:** c08fb10

## 1. Introducción

### 1.1 Propósito
Definir los requisitos funcionales y no funcionales
del videojuego La Búsqueda del Ídolo Perdido.

### 1.2 Alcance
Videojuego 3D de aventura y acción en tercera
persona, desarrollado con Three.js y Vite.

El sistema incluye exploración, combate,
recolección de objetos, progreso del jugador
y funcionalidades locales de cuenta.

### 1.3 Tecnologías actuales
- JavaScript ES Modules
- Three.js
- Vite
- WebGL
- Web Crypto API
- Web Storage API
- Blender

## 2. Actores

### ACT-001 Jugador
Interactúa con el videojuego.

### ACT-002 Jugador registrado
Utiliza una cuenta local para conservar progreso.

### ACT-003 Desarrollador
Mantiene y verifica los componentes del sistema.

### ACT-004 Auditor de seguridad
Evalúa los controles implementados
en un entorno autorizado.

## 3. Requisitos funcionales

| ID | Descripción | Estado |
|---|---|---|
| RF-001 | Iniciar partida | Por verificar |
| RF-002 | Controlar personaje | Por verificar |
| RF-003 | Explorar tres biomas | Por verificar |
| RF-004 | Recolectar ídolos | Por verificar |
| RF-005 | Combatir enemigos | Por verificar |
| RF-006 | Completar objetivos y cambiar de nivel | Por verificar |
| RF-007 | Registrar cuenta local | Por verificar |
| RF-008 | Guardar progreso | Por verificar |

## 4. Seguridad

| ID | Descripción | Estado |
|---|---|---|
| SEC-001 | Derivación segura de verificadores | Por verificar |
| SEC-002 | Validación de integridad del progreso | Por verificar |
| SEC-003 | Protección frente a entradas no confiables | Por verificar |
| SEC-004 | Gestión de sesión local | Requiere revisión |

## 5. Requisitos no funcionales

### RNF-001 Rendimiento
El sistema deberá definir y cumplir presupuestos
medibles de rendimiento para escenarios 3D.

### RNF-002 Mantenibilidad
Las responsabilidades deberán organizarse
en componentes con interfaces claras.

### RNF-003 Testabilidad
La lógica crítica deberá admitir pruebas
automatizadas reproducibles.

### RNF-004 Compatibilidad
Se identificarán los navegadores y dispositivos
objetivo y se comprobará su compatibilidad.

## 6. Restricciones
- Mantener compatibilidad con el código existente.
- No alterar gameplay sin pruebas de regresión.
- No introducir infraestructura innecesaria.
- Documentar decisiones arquitectónicas.

## 7. Pendientes
- Verificar cada requisito contra el código.
- Definir criterios de aceptación.
- Elaborar casos de uso completos.
- Crear matriz de trazabilidad.
- Registrar decisiones de arquitectura.
- Documentar modelo de amenazas.

## 8. Aprobación
Pendiente de revisión humana.
