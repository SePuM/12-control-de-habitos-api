import { NextResponse } from "next/server";
import { registroSchema } from "@/lib/schemas/registro";
import { registrarUsuario } from "@/lib/services/registro";
import {
  type CodigoErrorRegistro,
  RegistroError,
} from "@/lib/services/registro.errors";

export const runtime = "nodejs";

const ESTADOS_POR_CODIGO: Record<CodigoErrorRegistro, number> = {
  EMAIL_EN_USO: 409,
  PASSWORD_INVALIDA: 400,
  CREDENCIALES_INVALIDAS: 401,
  CONFIGURACION: 500,
  INTERNO: 500,
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
  const resultado = registroSchema.safeParse(cuerpo);

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
    const usuario = await registrarUsuario(resultado.data);
    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    if (error instanceof RegistroError) {
      return NextResponse.json(
        { error: error.message },
        { status: ESTADOS_POR_CODIGO[error.codigo] },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
