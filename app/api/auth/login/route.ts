import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas/login";
import { iniciarSesionUsuario } from "@/lib/services/login";
import { type CodigoErrorLogin, LoginError } from "@/lib/services/login.errors";

export const runtime = "nodejs";

const ESTADOS_POR_CODIGO: Record<CodigoErrorLogin, number> = {
  CREDENCIALES_INVALIDAS: 401,
  DEMASIADOS_INTENTOS: 429,
  CONFIGURACION: 500,
  INTERNO: 500,
};

const MENSAJES_POR_CODIGO: Record<CodigoErrorLogin, string> = {
  CREDENCIALES_INVALIDAS: "Credenciales inválidas",
  DEMASIADOS_INTENTOS: "Demasiados intentos",
  CONFIGURACION: "Error interno del servidor",
  INTERNO: "Error interno del servidor",
};

async function leerCuerpo(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerCuerpo(request);
  const resultado = loginSchema.safeParse(cuerpo);

  if (!resultado.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos",
        detalles: resultado.error.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensaje: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const sesion = await iniciarSesionUsuario(resultado.data);

    return NextResponse.json(sesion, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LoginError) {
      return NextResponse.json(
        { error: MENSAJES_POR_CODIGO[error.codigo] },
        { status: ESTADOS_POR_CODIGO[error.codigo] },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
