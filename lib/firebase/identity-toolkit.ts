import { z } from "zod";

const URL_SIGN_IN =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

const CODIGOS_DEMASIADOS_INTENTOS = new Set([
  "TOO_MANY_ATTEMPTS_TRY_LATER",
  "QUOTA_EXCEEDED",
]);

const sesionSchema = z.object({
  idToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.coerce.number().int().positive(),
  localId: z.string().min(1),
  email: z.string().email().optional(),
});

interface ErrorIdentityToolkit {
  error?: {
    message?: string;
  };
}

export interface SesionFirebase {
  idToken: string;
  refreshToken: string;
  expiraEnSeg: number;
  localId: string;
  email?: string;
}

export type MotivoErrorIdentityToolkit =
  "CREDENCIALES_INVALIDAS" | "DEMASIADOS_INTENTOS" | "RESPUESTA_INVALIDA";

export class IdentityToolkitError extends Error {
  constructor(readonly motivo: MotivoErrorIdentityToolkit) {
    super("Error de Identity Toolkit");
    this.name = "IdentityToolkitError";
  }
}

async function leerCodigoError(
  respuesta: Response,
): Promise<string | undefined> {
  try {
    const cuerpo = (await respuesta.json()) as ErrorIdentityToolkit;
    return cuerpo.error?.message;
  } catch {
    return undefined;
  }
}

function esDemasiadosIntentos(
  status: number,
  codigo: string | undefined,
): boolean {
  return (
    status === 429 ||
    (codigo !== undefined && CODIGOS_DEMASIADOS_INTENTOS.has(codigo))
  );
}

async function solicitarInicioSesion(
  email: string,
  password: string,
  apiKey: string,
): Promise<Response> {
  const respuesta = await fetch(
    `${URL_SIGN_IN}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  if (!respuesta.ok) {
    const codigo = await leerCodigoError(respuesta);

    if (esDemasiadosIntentos(respuesta.status, codigo)) {
      throw new IdentityToolkitError("DEMASIADOS_INTENTOS");
    }

    throw new IdentityToolkitError("CREDENCIALES_INVALIDAS");
  }

  return respuesta;
}

export async function iniciarSesion(
  email: string,
  password: string,
  apiKey: string,
): Promise<SesionFirebase> {
  const respuesta = await solicitarInicioSesion(email, password, apiKey);
  const resultado = sesionSchema.safeParse(await respuesta.json());

  if (!resultado.success) {
    throw new IdentityToolkitError("RESPUESTA_INVALIDA");
  }

  return {
    idToken: resultado.data.idToken,
    refreshToken: resultado.data.refreshToken,
    expiraEnSeg: resultado.data.expiresIn,
    localId: resultado.data.localId,
    email: resultado.data.email,
  };
}

export async function verificarCredenciales(
  email: string,
  password: string,
  apiKey: string,
): Promise<void> {
  await solicitarInicioSesion(email, password, apiKey);
}
