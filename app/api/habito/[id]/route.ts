import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { NoAutorizadoError, obtenerUidDesdeRequest } from "@/lib/auth/bearer";
import { habitoIdSchema, habitoSchema } from "@/lib/schemas/habito";
import { guardarHabito } from "@/lib/services/habito";

type ContextoRuta = {
  params: Promise<{ id: string }>;
};

async function leerCuerpo(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function respuestaValidacion(error: ZodError): Response {
  return NextResponse.json(
    {
      error: "Datos inválidos",
      detalles: error.issues.map((issue) => ({
        campo: issue.path.join(".") || "body",
        mensaje: issue.message,
      })),
    },
    { status: 400 },
  );
}

function respuestaError(status: number, mensaje: string): Response {
  return NextResponse.json({ error: mensaje, detalles: [] }, { status });
}

export async function PUT(
  request: Request,
  contexto: ContextoRuta,
): Promise<Response> {
  let uid: string;

  try {
    uid = await obtenerUidDesdeRequest(request);
  } catch (error) {
    if (error instanceof NoAutorizadoError) {
      return respuestaError(401, "No autorizado");
    }

    return respuestaError(500, "Error interno del servidor");
  }

  const { id } = await contexto.params;
  const idResultado = habitoIdSchema.safeParse(id);

  if (!idResultado.success) {
    return respuestaValidacion(idResultado.error);
  }

  const cuerpo = await leerCuerpo(request);
  const bodyResultado = habitoSchema.safeParse(cuerpo);

  if (!bodyResultado.success) {
    return respuestaValidacion(bodyResultado.error);
  }

  try {
    const documento = await guardarHabito(
      uid,
      idResultado.data,
      bodyResultado.data,
    );

    return NextResponse.json(documento, { status: 200 });
  } catch {
    return respuestaError(500, "Error interno del servidor");
  }
}
