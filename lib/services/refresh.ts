import {
  IdentityToolkitError,
  renovarSesion,
} from "@/lib/firebase/identity-toolkit";
import type { RefreshInput } from "@/lib/schemas/refresh";
import { RefreshError } from "@/lib/services/refresh.errors";

export interface RefreshResultado {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
}

function mapearError(error: unknown): RefreshError {
  if (
    error instanceof IdentityToolkitError &&
    error.motivo === "REFRESH_TOKEN_INVALIDO"
  ) {
    return new RefreshError(
      "REFRESH_TOKEN_INVALIDO",
      "Token de refresco inválido",
    );
  }

  return new RefreshError("INTERNO", "No se pudo renovar la sesión");
}

export async function renovarSesionUsuario(
  datos: RefreshInput,
): Promise<RefreshResultado> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey) {
    throw new RefreshError(
      "CONFIGURACION",
      "Falta la configuración de Firebase",
    );
  }

  try {
    const sesion = await renovarSesion(datos.refreshToken, apiKey);

    return {
      token: sesion.idToken,
      refreshToken: sesion.refreshToken,
      expiraEnSeg: sesion.expiraEnSeg,
    };
  } catch (error) {
    throw mapearError(error);
  }
}
