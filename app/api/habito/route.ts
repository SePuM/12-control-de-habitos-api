import { type NextRequest, NextResponse } from "next/server";
import type { ZodError } from "zod";
import { NoAutorizadoError, obtenerUidDesdeRequest } from "@/lib/auth/bearer";
import { habitoQuerySchema } from "@/lib/schemas/habito";
import { listarHabitos } from "@/lib/services/habito";

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

  const sinceParam = request.nextUrl.searchParams.get("since") ?? undefined;
  const queryResultado = habitoQuerySchema.safeParse({ since: sinceParam });

  if (!queryResultado.success) {
    return respuestaValidacion(queryResultado.error);
  }

  try {
    const since = queryResultado.data.since
      ? new Date(queryResultado.data.since)
      : undefined;
    const habitos = await listarHabitos(uid, since);

    return NextResponse.json(habitos, { status: 200 });
  } catch {
    return respuestaError(500, "Error interno del servidor");
  }
}
