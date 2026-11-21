# Configuración de IA - API (Proyecto 12)

## Barreras y Riesgos Cubiertos

1. **Fuga de Secretos:** Se bloqueó la lectura de archivos `**/.env*`, `*.pem`, `*.key` y credenciales JSON para proteger `FIREBASE_PRIVATE_KEY` y `FIREBASE_WEB_API_KEY`.
2. **Acceso al Sistema:** Se restringió a la IA de salir de la carpeta de trabajo usando un sandbox estricto (`allowRead: ["."]`, `denyRead: ["~/"]`), evitando lectura o escritura en directorios del sistema.
3. **Acciones no deseadas:** Comandos como `git push`, `npm install` o `vercel` están bloqueados o requieren permiso explícito para evitar despliegues accidentales o inyección de código.

## Límites y Ajustes Hechos

- **Inyección de Prompts:** Un permiso bloquea archivos, pero un prompt malicioso puede estar en la base de datos. Se ajustó el `AGENTS.md` para que la IA trate respuestas de la API como datos y no como órdenes.
- **Entorno local:** Verificado en Windows nativo con PowerShell; no fue necesario ejecutar bajo WSL2 para este cierre.
- **Firestore:** `firestore.rules` niega todo acceso a clientes y `firestore.indexes.json` declara los índices usados por las consultas actuales.
- **Fechas:** `fechaRegistroSchema` rechaza `YYYY-MM-DD` posteriores a la fecha UTC del servidor sin aceptar valores secretos ni de entorno.
