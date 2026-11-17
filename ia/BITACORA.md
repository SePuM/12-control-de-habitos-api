# Bitácora de Uso de IA

_Nota: Se llenará una vez por tarea usando el ciclo: Modo plan -> Edición -> Revisión del diff completo._

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

### Registro: Planificación endpoint POST /api/auth/login

- **Tarea:** Diseño arquitectónico y casos de prueba TDD para el inicio de sesión (`POST /api/auth/login`).
- **Propósito:** Validar credenciales usando Identity Toolkit, devolver estructura estricta (`{ token, refreshToken, expiraEnSeg, usuario }`) y manejar errores de seguridad (401 genérico para evitar enumeración, 429 para rate limit).
- **Evidencia / Prompt:** Ejecución de Modo Plan analizando requisitos (sección 9.1) y código existente (`lib/firebase/`, endpoint de registro).
- **Validación / Pruebas:** Se aprueba el diseño de 16 casos de prueba, la extensión segura de `identity-toolkit.ts` (sin romper tests anteriores) y la validación Zod que normaliza correos.
- **Decisión:** Plan aprobado. Se procede a ejecutar la fase Roja (TDD) creando únicamente `tests/api/auth/login.test.ts`.

### Registro: Implementación endpoint POST /api/auth/login (Fase Verde)

- **Tarea:** Implementación de esquemas Zod, servicio `iniciarSesion` (Identity Toolkit REST API), y Route Handler `POST /api/auth/login`.
- **Propósito:** Hacer pasar los 16 tests TDD respetando el contrato de respuesta y la seguridad (ocultar enumeración de usuarios).
- **Evidencia / Prompt:** Ejecución en modo Build para implementar el plan aprobado (pasos 2-8).
- **Validación / Pruebas:** Se ejecutó la suite completa (29/29 tests aprobados) y `npm run check` arrojando un 96.22% de cobertura de código. Se omitió temporalmente la advertencia de ESM de Vite.
- **Decisión:** Implementación del endpoint aprobada y lista para integrarse al registro de la aplicación móvil.

### Registro: Planificación endpoint POST /api/auth/refresh

- **Tarea:** Diseño TDD para la renovación del token de sesión (`POST /api/auth/refresh`).
- **Propósito:** Validar el `refreshToken` usando la API `securetoken.googleapis.com` de Firebase y devolver la sesión renovada (`{ token, refreshToken, expiraEnSeg }`) o un error 401 genérico ("Token de refresco inválido").
- **Evidencia / Prompt:** Ejecución en Modo Plan analizando el contrato y la integración aditiva con `identity-toolkit.ts`.
- **Validación / Pruebas:** Se aprueban 17 casos de prueba para cubrir validación Zod, conexión con Secure Token API y manejo seguro del error 401 y 500 sin exponer detalles de Firebase.
- **Decisión:** Plan aprobado. Se procede a ejecutar la Fase Roja TDD.

### Registro: Implementación endpoint POST /api/auth/refresh (Fase Verde)

- **Tarea:** Implementación de esquemas Zod, servicio `renovarSesion` (Secure Token API), y Route Handler `POST /api/auth/refresh`.
- **Propósito:** Hacer pasar los 17 tests TDD para renovar el token de sesión. Además, se limpiaron los tests obsoletos de `runtime = "nodejs"` en registro y login para cumplir con Next.js 16.4.
- **Evidencia / Prompt:** Ejecución en modo Build para implementar el plan sin usar la directiva `runtime`.
- **Validación / Pruebas:** Se ejecutó `npm run check` arrojando un 100% de éxito en 44 pruebas (Registro, Login, Refresh) y un 96.5% de cobertura.
- **Decisión:** Implementación del endpoint aprobada. Fin de la arquitectura de autenticación.

### Registro: Planificación endpoint PUT /api/habito/[id]

- **Tarea:** Diseño arquitectónico y casos de prueba TDD para la creación y actualización idempotente de hábitos (`PUT /api/habito/[id]`).
- **Propósito:** Implementar autenticación centralizada mediante Bearer token (`verifyIdToken`), validación estricta con Zod (nombre 2-40 chars, meta de pasos 500-50000), y upsert transaccional en Firestore (`usuarios/{uid}/habito/{id}`) conservando `created_at` y serializando timestamps a ISO 8601.
- **Evidencia / Prompt:** Ejecución de Modo Plan analizando reglas de negocio (secciones 9.2-9.4) y compatibilidad con Next.js 16.4.
- **Validación / Pruebas:** Se aprueba el diseño de 20 casos de prueba en Vitest cubriendo errores 401 (auth), 400 (validación y campos extra), 200 (creación/actualización idempotente) y 500 (fallos de Firestore).
- **Decisión:** Plan aprobado. Se procede a ejecutar la Fase Roja (TDD) creando únicamente `tests/api/habito/put.test.ts`.

### Registro: Implementación endpoint PUT /api/habito/[id] (Fase Verde)

- **Tarea:** Implementar autenticación, validación Zod y transacción en Firestore para `PUT /api/habito/[id]`.
- **Propósito:** Hacer pasar los 20 tests unitarios asegurando idempotencia (conservación de `created_at`), inyección de timestamps (`updated_at`, `deleted_at: null`) y rechazo de variables no autorizadas.
- **Evidencia / Prompt:** Ejecución en modo Build para crear los servicios y esquemas planificados. Se ajustó el mock de `docUsuario` en los tests para corregir advertencias de TypeScript.
- **Validación / Pruebas:** `npm run check` completado con éxito. 64/64 pruebas en verde y >93% de cobertura global.
- **Decisión:** Implementación del endpoint aprobada.

### Registro: Planificación endpoint GET /api/habito

- **Tarea:** Diseño arquitectónico y casos de prueba TDD para la consulta y sincronización de hábitos (`GET /api/habito`).
- **Propósito:** Implementar la lectura de Firestore (`usuarios/{uid}/habito`) filtrada opcionalmente por `updated_at >= since`. Se incluirán los documentos eliminados lógicamente (`deleted_at != null`) y se serializarán las fechas a ISO 8601 para que la app móvil en React Native pueda sincronizar su base de datos local SQLite.
- **Evidencia / Prompt:** Ejecución en Modo Plan. Se decidió usar `NextRequest` para leer `nextUrl.searchParams` y `z.iso.datetime()` de Zod para validar el parámetro `since`.
- **Validación / Pruebas:** Se aprueba el diseño de 16 casos de prueba unitaria cubriendo 401 (auth), 400 (parámetro `since` inválido), 200 (consultas con y sin filtro, incluyendo borrados lógicos) y 500 (fallo interno).
- **Decisión:** Plan aprobado. Se procede a la Fase Roja (TDD) creando únicamente `tests/api/habito/get.test.ts`.

### Registro: Implementación endpoint GET /api/habito (Fase Verde)
- **Tarea:** Implementar `GET /api/habito` para listar y sincronizar hábitos.
- **Propósito:** Hacer pasar los 16 tests unitarios. Se añadió la validación `since` (ISO 8601 UTC) y la lógica de filtrado `>= updated_at` en Firestore, incluyendo borrados lógicos y la serialización nativa de Zod.
- **Evidencia / Prompt:** Ejecución en modo Build. El agente solucionó errores de tipado en los mocks de pruebas (`tests/api/habito/get.test.ts`) y formateó proactivamente los archivos Markdown para cumplir con las reglas de Prettier del proyecto.
- **Validación / Pruebas:** `npm run check` completado con éxito. 80/80 pruebas en verde. Cobertura global >93.8%.
- **Decisión:** Implementación del endpoint aprobada.

### Registro: Planificación endpoint DELETE /api/habito/[id]
- **Tarea:** Diseño arquitectónico y casos de prueba TDD para el borrado lógico de hábitos (`DELETE /api/habito/[id]`).
- **Propósito:** Implementar una transacción Firestore que busque el documento y le aplique un `update` para inyectar `deleted_at: serverTimestamp()` y `updated_at: serverTimestamp()` conservando los demás campos. Si no existe, devuelve 404. La respuesta 200 devuelve el documento actualizado.
- **Evidencia / Prompt:** Ejecución en Modo Plan. Se extenderán los errores de dominio para incluir `NO_ENCONTRADO` y se usarán métodos transaccionales para garantizar atomicidad y devolver timestamps ISO 8601.
- **Validación / Pruebas:** Se aprueba el diseño de 17 casos unitarios cubriendo 401, 400 (id inválido), 404 (documento inexistente), 200 (borrado lógico idempotente preservando data) y 500.
- **Decisión:** Plan aprobado. Se procede a la Fase Roja (TDD) creando únicamente `tests/api/habito/delete.test.ts`.