import { type NextRequest, NextResponse } from "next/server";
import type { ZodError } from "zod";
import { NoAutorizadoError, obtenerUidDesdeRequest } from "@/lib/auth/bearer";
import { registroHabitoQuerySchema } from "@/lib/schemas/registro-habito";
import { listarRegistrosPorFecha } from "@/lib/services/registro-habito";

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

export async function GET(request: NextRequest): Promise<Response> {
  let uid: string;

  try {
    uid = await obtenerUidDesdeRequest(request);
  } catch (error) {
    if (error instanceof NoAutorizadoError) {
      return respuestaError(401, "No autorizado");
    }

    return respuestaError(500, "Error interno del servidor");
  }

  const fechaParam = request.nextUrl.searchParams.get("fecha") ?? undefined;
  const queryResultado = registroHabitoQuerySchema.safeParse({
    fecha: fechaParam,
  });

  if (!queryResultado.success) {
    return respuestaValidacion(queryResultado.error);
  }

  try {
    const registros = await listarRegistrosPorFecha(
      uid,
      queryResultado.data.fecha,
    );

    return NextResponse.json(registros, { status: 200 });
  } catch {
    return respuestaError(500, "Error interno del servidor");
  }
}
