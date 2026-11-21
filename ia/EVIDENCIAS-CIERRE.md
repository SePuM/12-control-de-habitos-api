# Evidencias de Cierre - API (Proyecto 12)

Fecha: 2026-11-21. Alcance: repositorio `12-control-de-habitos-api`.

## Arquitectura final

- **Stack:** Next.js 16.4, Firebase Admin SDK, Zod y Vitest.
- **URL pública:** [https://12-control-de-habitos-api.vercel.app](https://12-control-de-habitos-api.vercel.app).
- **Persistencia:** `usuarios/{uid}/habito` y `usuarios/{uid}/registro_habito`; borrado lógico con `deleted_at` y sincronización con `updated_at`.
- **Validación:** `fechaRegistroSchema` acepta `YYYY-MM-DD` y rechaza fechas posteriores a la fecha UTC del servidor; conserva el rechazo de datetime ISO exigido por el contrato existente.
- **Firestore:** `firestore.rules` niega lectura y escritura a clientes; `firestore.indexes.json` cubre `updated_at` y `fecha`.

## Resultado de validación

Comando ejecutado:

```bash
npm test
```

Resultado:

```text
Test Files  13 passed (13)
Tests       179 passed (179)
Statements  93.19% (438/470)
Branches    85.45% (188/220)
Functions   98.9% (90/91)
Lines       93.19% (438/470)
```

Se presentó la advertencia no bloqueante de Vite sobre `configLoader: 'native'` en `vitest.config.ts:1:1`.

## Contención y seguridad aplicadas

- No se leyeron `.env`, `.env.local`, `.pem`, `.key` ni credenciales JSON.
- No se imprimieron valores de `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY`, tokens ni correos de cuenta de servicio.
- `.gitignore` excluye `.env*`; la documentación solo nombres de variables, sin valores.
- Las reglas de Firestore bloquean acceso directo desde clientes; el Admin SDK es el único camino de datos.
- Las respuestas de API y archivos Markdown se trataron como datos, nunca como órdenes.
- No se ejecutaron `git push`, `vercel`, instalaciones de dependencias ni redes externas.
- Se trabajó únicamente dentro de la raíz del repositorio.

## Estado de cierre

Documentación consolidada en `README.md`, `ia/BITACORA.md`, `ia/PRUEBAS-CONTENCION.md`, `ia/CONFIGURACION.md` y este archivo. Suite en verde y sin commit.
