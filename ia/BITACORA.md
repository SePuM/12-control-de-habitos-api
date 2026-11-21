# Bitácora de Uso de IA

_Nota: Cada tarea se registra con el ciclo: Modo plan -> Edición -> Revisión del diff completo._

## Registro de Tareas

- **Tarea:** Ajustes puntuales de cierre (permisos Android, fechas futuras, Firestore y documentación).
- **Propósito:** Completar seguridad y evidencias sin exponer secretos ni romper las suites existentes.
- **Evidencia / Prompt:** Solicitud del usuario con cinco cambios puntuales y verificación final TDD.
- **Validación / Pruebas:** Nuevas pruebas en rojo y luego en verde; `npm test` y `npm run check`.
- **Decisión:** Aprobado para revisión; sin commit.

## Casos de Rechazo o Corrección (Mínimo 3 obligatorios)

1. **Caso 1:** Se descartó exportar `runtime = "nodejs"` en rutas Next.js 16.4; se conservó la convención del repositorio.
2. **Caso 2:** Se corrigieron tipados de mocks en Vitest para eliminar `any` y mantener `strict`.
3. **Caso 3:** Se reemplazaron textos incompletos y el README por defecto por evidencias y documentación real del cierre.

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

### Registro: Implementación endpoint DELETE /api/habito/[id] (Fase Verde)

- **Tarea:** Implementar el endpoint de borrado lógico transaccional `DELETE /api/habito/[id]`.
- **Propósito:** Hacer pasar los 17 tests (TDD). Se implementó `transaction.update()` en Firestore para inyectar `deleted_at: serverTimestamp()` conservando la información original.
- **Evidencia / Prompt:** Ejecución en modo Build. Se capturó correctamente el error `NO_ENCONTRADO` (404) y el handler serializó el documento en formato ISO 8601 UTC.
- **Validación / Pruebas:** `npm run check` completado. 97/97 tests en verde. Cobertura global de 94.5% (statements/lines).
- **Decisión:** Implementación del endpoint aprobada. El CRUD de Hábitos y la API quedan concluidos.

### Registro: Planificación endpoint PUT/DELETE /api/registro_habito/[habitoId]/[fecha]

- **Tarea:** Diseño arquitectónico y casos de prueba TDD para registros diarios de hábitos (`PUT` / `DELETE` / `GET`).
- **Propósito:** Implementar persistencia en subcolección `usuarios/{uid}/registro_habito/{habitoId}_{fecha}`, validación estricta con Zod, integridad transaccional (validando existencia de hábito activo) y API RESTful.
- **Evidencia / Prompt:** Ejecución en Modo Plan aprobada.
- **Validación / Pruebas:** Se aprueba el diseño de tests (PUT: 22 casos, DELETE: 20 casos, GET: 12 casos) cubriendo validaciones, auth y casos de borde.
- **Decisión:** Plan aprobado. Se procede a ejecutar TDD por operación (fase roja/verde).

### Registro: Implementación endpoints Registro de Hábitos (Fases Verde)

- **Tarea:** Implementación de esquemas Zod, servicio `registro-habito`, y endpoints `PUT`, `DELETE`, `GET`.
- **Propósito:** Finalizar la implementación respetando TDD y reglas del repositorio.
- **Evidencia / Prompt:** Ejecución en Modo Build.
- **Validación / Pruebas:** `npm run check` exitoso (151/151 pruebas aprobadas).
- **Decisión:** Implementación aprobada. API completa con soporte para registros diarios.

### Registro: Planificación cálculo de rachas (Fase Plan)

- **Tarea:** Diseñar `GET /api/registro_habito/estadisticas` y servicio de racha actual por hábito.
- **Propósito:** Definir día completado (`cantidad >= meta`, `cantidad > 0`, `deleted_at == null`), reglas de fecha de referencia y exclusión de hábitos/registros borrados.
- **Evidencia / Prompt:** Ejecución en Modo Plan. Se propuso respuesta `{ fecha, rachas }` con `fecha` opcional y dos lecturas Firestore sin N+1.
- **Validación / Pruebas:** Se aprobaron 20 casos TDD (10 de servicio y 10 de endpoint).
- **Decisión:** Plan aprobado con precisiones sobre fecha local del cliente y borrados lógicos.

### Registro: Implementación cálculo de rachas (Fases Roja/Verde)

- **Tarea:** Implementar esquema de consulta, listado global de registros, servicio de rachas y endpoint de estadísticas.
- **Propósito:** Calcular `racha_actual` desde registros activos y meta vigente, respetando `?fecha=YYYY-MM-DD` o UTC por defecto.
- **Evidencia / Prompt:** Ejecución en Modo Build con TDD estricto: fase roja con 20 fallos y fase verde con 20 aciertos.
- **Validación / Pruebas:** `npm run check` exitoso. 171/171 pruebas aprobadas. Cobertura global de 93.14% (statements/lines).
- **Decisión:** Implementación aprobada. El hito de rachas queda completado.

### Registro: Ajustes de cierre y contención (Fases Roja/Verde)

- **Tarea:** Permisos Android, rechazo de fechas futuras, reglas/índices Firestore y documentación de cierre.
- **Propósito:** Conservar el contrato existente de `YYYY-MM-DD`, reforzar la seguridad y dejar evidencias sin secretos.
- **Evidencia / Prompt:** Solicitud puntual del usuario con verificación final en ambos repositorios.
- **Validación / Pruebas:** Fase roja verificada antes de cada implementación; fase verde con 8 pruebas nuevas aprobadas y suite API en 179/179.
- **Decisión:** Aprobado para revisión; no se creó commit.
