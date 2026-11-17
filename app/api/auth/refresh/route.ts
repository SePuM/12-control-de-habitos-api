import { NextResponse } from "next/server";
import { refreshSchema } from "@/lib/schemas/refresh";
import { renovarSesionUsuario } from "@/lib/services/refresh";
import {
  type CodigoErrorRefresh,
  RefreshError,
} from "@/lib/services/refresh.errors";

const ESTADOS_POR_CODIGO: Record<CodigoErrorRefresh, number> = {
  REFRESH_TOKEN_INVALIDO: 401,
  CONFIGURACION: 500,
  INTERNO: 500,
};

const MENSAJES_POR_CODIGO: Record<CodigoErrorRefresh, string> = {
  REFRESH_TOKEN_INVALIDO: "Token de refresco inválido",
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
  const resultado = refreshSchema.safeParse(cuerpo);

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
    const sesion = await renovarSesionUsuario(resultado.data);

    return NextResponse.json(sesion, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RefreshError) {
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
