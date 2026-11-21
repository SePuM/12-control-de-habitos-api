import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { NoAutorizadoError, obtenerUidDesdeRequest } from "@/lib/auth/bearer";
import {
  registroHabitoParamsSchema,
  registroHabitoSchema,
} from "@/lib/schemas/registro-habito";
import {
  eliminarRegistroHabito,
  guardarRegistroHabito,
} from "@/lib/services/registro-habito";
import { RegistroHabitoError } from "@/lib/services/registro-habito.errors";

type ContextoRuta = {
  params: Promise<{ habitoId: string; fecha: string }>;
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

function respuestaErrorDominio(error: RegistroHabitoError): Response {
  if (error.codigo === "HABITO_NO_ENCONTRADO") {
    return respuestaError(404, "Hábito no encontrado");
  }

  if (error.codigo === "REGISTRO_NO_ENCONTRADO") {
    return respuestaError(404, "Registro no encontrado");
  }

  return respuestaError(500, "Error interno del servidor");
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

  const { habitoId, fecha } = await contexto.params;
  const paramsResultado = registroHabitoParamsSchema.safeParse({
    habitoId,
    fecha,
  });

  if (!paramsResultado.success) {
    return respuestaValidacion(paramsResultado.error);
  }

  const cuerpo = await leerCuerpo(request);
  const bodyResultado = registroHabitoSchema.safeParse(cuerpo);

  if (!bodyResultado.success) {
    return respuestaValidacion(bodyResultado.error);
  }

  try {
    const documento = await guardarRegistroHabito(
      uid,
      paramsResultado.data.habitoId,
      paramsResultado.data.fecha,
      bodyResultado.data,
    );

    return NextResponse.json(documento, { status: 200 });
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      return respuestaErrorDominio(error);
    }

    return respuestaError(500, "Error interno del servidor");
  }
}

export async function DELETE(
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

  const { habitoId, fecha } = await contexto.params;
  const paramsResultado = registroHabitoParamsSchema.safeParse({
    habitoId,
    fecha,
  });

  if (!paramsResultado.success) {
    return respuestaValidacion(paramsResultado.error);
  }

  try {
    const documento = await eliminarRegistroHabito(
      uid,
      paramsResultado.data.habitoId,
      paramsResultado.data.fecha,
    );

    return NextResponse.json(documento, { status: 200 });
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      return respuestaErrorDominio(error);
    }

    return respuestaError(500, "Error interno del servidor");
  }
}
