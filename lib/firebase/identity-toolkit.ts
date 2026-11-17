import { z } from "zod";

const URL_SIGN_IN =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

const URL_SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";

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

const sesionRenovadaSchema = z.object({
  id_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive(),
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

export interface SesionRenovadaFirebase {
  idToken: string;
  refreshToken: string;
  expiraEnSeg: number;
}

export type MotivoErrorIdentityToolkit =
  | "CREDENCIALES_INVALIDAS"
  | "DEMASIADOS_INTENTOS"
  | "REFRESH_TOKEN_INVALIDO"
  | "RESPUESTA_INVALIDA";

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

export async function renovarSesion(
  refreshToken: string,
  apiKey: string,
): Promise<SesionRenovadaFirebase> {
  const respuesta = await fetch(
    `${URL_SECURE_TOKEN}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    },
  );

  if (!respuesta.ok) {
    throw new IdentityToolkitError("REFRESH_TOKEN_INVALIDO");
  }

  const resultado = sesionRenovadaSchema.safeParse(await respuesta.json());

  if (!resultado.success) {
    throw new IdentityToolkitError("RESPUESTA_INVALIDA");
  }

  return {
    idToken: resultado.data.id_token,
    refreshToken: resultado.data.refresh_token,
    expiraEnSeg: resultado.data.expires_in,
  };
}
