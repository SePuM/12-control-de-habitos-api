import { getAdminAuth } from "@/lib/firebase/admin";

const PATRON_BEARER = /^Bearer\s+(\S+)$/i;

export class NoAutorizadoError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "NoAutorizadoError";
  }
}

export async function obtenerUidDesdeRequest(
  request: Request,
): Promise<string> {
  const autorizacion = request.headers.get("authorization");

  if (!autorizacion) {
    throw new NoAutorizadoError();
  }

  const coincidencia = PATRON_BEARER.exec(autorizacion.trim());
  const token = coincidencia?.[1];

  if (!token) {
    throw new NoAutorizadoError();
  }

  try {
    const sesion = await getAdminAuth().verifyIdToken(token);

    if (!sesion.uid) {
      throw new NoAutorizadoError();
    }

    return sesion.uid;
  } catch {
    throw new NoAutorizadoError();
  }
}
