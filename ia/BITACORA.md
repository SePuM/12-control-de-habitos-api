# Bitácora de Uso de IA

*Nota: Se llenará una vez por tarea usando el ciclo: Modo plan -> Edición -> Revisión del diff completo.*

## Registro de Tareas
- **Tarea:** (Ej. Crear endpoint de Login)
- **Propósito:** (Lo que se busca lograr)
- **Evidencia / Prompt:** (El texto enviado)
- **Validación / Pruebas:** (Comprobación en Vitest)
- **Decisión:** (Aprobado / Rechazado)

## Casos de Rechazo o Corrección (Mínimo 3 obligatorios)
1. **Caso 1:** (Pendiente de documentar durante el desarrollo)
2. **Caso 2:** (Pendiente de documentar durante el desarrollo)
3. **Caso 3:** (Pendiente de documentar durante el desarrollo)

### Registro: Planificación endpoint POST /api/auth/registro
- **Tarea:** Diseño arquitectónico y casos de prueba TDD para el registro de usuarios (`POST /api/auth/registro`).
- **Propósito:** Definir validación estricta con Zod, creación en Firebase Auth + perfil en Firestore (`usuarios/{uid}`), verificación de credenciales vía Identity Toolkit (401) con rollback ante fallos, y batería de 13 pruebas unitarias en Vitest.
- **Evidencia / Prompt:** Ejecución de Modo Plan en OpenCode analizando `AGENTS.md` y dependencias del proyecto.
- **Validación / Pruebas:** Se revisó el plan generado por el agente. Se valida el manejo de errores HTTP (400, 401, 409, 500, 201), la exportación de `runtime = "nodejs"` y el orden estricto TDD (primero pruebas en rojo, luego implementación).
- **Decisión:** Plan aprobado. Se autoriza la instalación de `@vitest/coverage-v8` y se procede a ejecutar la fase Roja (TDD) creando `vitest.config.ts` y `tests/api/auth/registro.test.ts`.

### Registro: Implementación endpoint POST /api/auth/registro (Fase Verde)
- **Tarea:** Implementación de esquemas Zod, cliente Firebase Admin, verificación Identity Toolkit, servicio con rollback y Route Handler `POST /api/auth/registro`.
- **Propósito:** Hacer pasar las 13 pruebas unitarias definidas en la fase roja y cumplir con las reglas de validación, seguridad y cobertura.
- **Evidencia / Prompt:** Ejecución en modo Build tras aprobar la fase roja; ajuste automático de tipado `Response` en mocks de `tests/api/auth/registro.test.ts` y formateo con Prettier.
- **Validación / Pruebas:** `npm run check` exitoso (`typecheck`, `lint`, `format:check` y `vitest --coverage` con 13/13 pruebas aprobadas y 96.07% de cobertura de sentencias).
- **Decisión:** Implementación aprobada y lista para commit.