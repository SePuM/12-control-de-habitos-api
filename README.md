# API Control de Hábitos (Proyecto 12)

API REST de hábitos con racha construida con Next.js 16.4, Firebase Admin SDK y validación estricta con Zod.

Despliegue: [https://12-control-de-habitos-api.vercel.app](https://12-control-de-habitos-api.vercel.app)

## Seguridad

- Las rutas exigen `Authorization: Bearer <idToken>`; la verificación usa Firebase Admin SDK.
- `firestore.rules` niega lectura y escritura a clientes (`allow read, write: if false;`). El backend usa Admin SDK, que opera fuera de esas reglas.
- `firestore.indexes.json` declara los índices de `updated_at` en `habito` y `fecha` en `registro_habito`.
- Las fechas de registro usan `YYYY-MM-DD` (ISO 8601 de día) y se rechazan las posteriores a la fecha UTC del servidor.
- `.gitignore` excluye `.env*`; los valores reales solo se configuran en Vercel.

## Variables de entorno en Vercel

Configurar en **Project Settings > Environment Variables** para Production, Preview y Development según corresponda. No se incluyen valores en este repositorio ni en esta documentación.

| Variable                | Uso                                                         |
| ----------------------- | ----------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | Identificador del proyecto de Firebase.                     |
| `FIREBASE_CLIENT_EMAIL` | Correo de la cuenta de servicio de Firebase Admin.          |
| `FIREBASE_PRIVATE_KEY`  | Clave privada de la cuenta de servicio en una sola línea.   |
| `FIREBASE_WEB_API_KEY`  | Clave web pública usada por Identity Toolkit y SecureToken. |

## Endpoints

### Autenticación

| Método | Ruta                 | Descripción                                |
| ------ | -------------------- | ------------------------------------------ |
| `POST` | `/api/auth/registro` | Crea usuario y perfil.                     |
| `POST` | `/api/auth/login`    | Devuelve sesión (`token`, `refreshToken`). |
| `POST` | `/api/auth/refresh`  | Renueva la sesión.                         |

### Hábitos

| Método   | Ruta                      | Descripción                                    |
| -------- | ------------------------- | ---------------------------------------------- |
| `GET`    | `/api/habito?since=<ISO>` | Lista hábitos para sincronización.             |
| `PUT`    | `/api/habito/[id]`        | Crea o actualiza un hábito por id del cliente. |
| `DELETE` | `/api/habito/[id]`        | Borrado lógico.                                |

### Registros y rachas

| Método   | Ruta                                          | Descripción                          |
| -------- | --------------------------------------------- | ------------------------------------ |
| `GET`    | `/api/registro_habito?fecha=YYYY-MM-DD`       | Lista registros por fecha.           |
| `PUT`    | `/api/registro_habito/[habitoId]/[fecha]`     | Crea o actualiza el registro diario. |
| `DELETE` | `/api/registro_habito/[habitoId]/[fecha]`     | Borrado lógico del registro.         |
| `GET`    | `/api/registro_habito/estadisticas?fecha=...` | Devuelve `racha_actual` por hábito.  |

## Pruebas

```bash
npm test
```

La suite cubre autenticación, validación Zod, operaciones Firestore simuladas, rachas, rechazo de fechas futuras y configuración base de Firestore. La ejecución final de este cierre quedó en **13 archivos y 179 pruebas aprobadas**, con cobertura de 93.19% statements/lines, 85.45% branches y 98.9% functions.
