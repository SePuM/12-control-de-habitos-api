import {
  IdentityToolkitError,
  iniciarSesion,
  type SesionFirebase,
} from "@/lib/firebase/identity-toolkit";
import type { LoginInput } from "@/lib/schemas/login";
import { LoginError } from "@/lib/services/login.errors";

export interface UsuarioLogin {
  id: string;
  email: string;
}

export interface LoginResultado {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: UsuarioLogin;
}

function mapearError(error: unknown): LoginError {
  if (error instanceof IdentityToolkitError) {
    if (error.motivo === "CREDENCIALES_INVALIDAS") {
      return new LoginError("CREDENCIALES_INVALIDAS", "Credenciales inválidas");
    }

    if (error.motivo === "DEMASIADOS_INTENTOS") {
      return new LoginError("DEMASIADOS_INTENTOS", "Demasiados intentos");
    }
  }

  return new LoginError("INTERNO", "No se pudo iniciar sesión");
}

function construirResultado(
  sesion: SesionFirebase,
  email: string,
): LoginResultado {
  return {
    token: sesion.idToken,
    refreshToken: sesion.refreshToken,
    expiraEnSeg: sesion.expiraEnSeg,
    usuario: {
      id: sesion.localId,
      email: sesion.email ?? email,
    },
  };
}

export async function iniciarSesionUsuario(
  datos: LoginInput,
): Promise<LoginResultado> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey) {
    throw new LoginError("CONFIGURACION", "Falta la configuración de Firebase");
  }

  try {
    const sesion = await iniciarSesion(datos.email, datos.password, apiKey);
    return construirResultado(sesion, datos.email);
  } catch (error) {
    throw mapearError(error);
  }
}
