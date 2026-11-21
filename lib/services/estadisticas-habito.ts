import type { HabitoDocumento } from "@/lib/services/habito";
import { listarHabitos } from "@/lib/services/habito";
import {
  listarRegistros,
  type RegistroHabitoDocumento,
} from "@/lib/services/registro-habito";
import { RegistroHabitoError } from "@/lib/services/registro-habito.errors";

export interface RachaHabito {
  habito_id: string;
  nombre: string;
  meta: number;
  activo: boolean;
  racha_actual: number;
  ultima_fecha_completada: string | null;
}

export interface EstadisticasRachas {
  fecha: string;
  rachas: RachaHabito[];
}

interface ResultadoRacha {
  racha_actual: number;
  ultima_fecha_completada: string | null;
}

function fechaHoyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function fechaAnterior(fecha: string): string {
  const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

  fechaDate.setUTCDate(fechaDate.getUTCDate() - 1);

  return fechaDate.toISOString().slice(0, 10);
}

function obtenerMeta(meta: number): number {
  return meta > 0 ? meta : 1;
}

function fechasCompletadas(
  habitoId: string,
  meta: number,
  registros: RegistroHabitoDocumento[],
  fechaReferencia: string,
): Set<string> {
  const fechas = new Set<string>();

  for (const registro of registros) {
    if (
      registro.habito_id !== habitoId ||
      registro.deleted_at !== null ||
      registro.fecha > fechaReferencia ||
      registro.cantidad <= 0 ||
      registro.cantidad < meta
    ) {
      continue;
    }

    fechas.add(registro.fecha);
  }

  return fechas;
}

function calcularRacha(
  fechas: Set<string>,
  fechaReferencia: string,
): ResultadoRacha {
  let fecha = fechaReferencia;

  if (!fechas.has(fecha)) {
    fecha = fechaAnterior(fecha);

    if (!fechas.has(fecha)) {
      return { racha_actual: 0, ultima_fecha_completada: null };
    }
  }

  let racha = 0;
  let ultima: string | null = null;

  while (fechas.has(fecha)) {
    if (ultima === null) {
      ultima = fecha;
    }

    racha += 1;
    fecha = fechaAnterior(fecha);
  }

  return { racha_actual: racha, ultima_fecha_completada: ultima };
}

function construirRacha(
  habito: HabitoDocumento,
  registros: RegistroHabitoDocumento[],
  fechaReferencia: string,
): RachaHabito {
  const meta = obtenerMeta(habito.meta);
  const fechas = fechasCompletadas(habito.id, meta, registros, fechaReferencia);
  const { racha_actual, ultima_fecha_completada } = calcularRacha(
    fechas,
    fechaReferencia,
  );

  return {
    habito_id: habito.id,
    nombre: habito.nombre,
    meta,
    activo: habito.activo,
    racha_actual,
    ultima_fecha_completada,
  };
}

export async function obtenerEstadisticasRachas(
  uid: string,
  fecha?: string,
): Promise<EstadisticasRachas> {
  const fechaReferencia = fecha ?? fechaHoyUTC();

  try {
    const [habitos, registros] = await Promise.all([
      listarHabitos(uid),
      listarRegistros(uid),
    ]);
    const rachas = habitos
      .filter((habito) => habito.deleted_at === null)
      .map((habito) => construirRacha(habito, registros, fechaReferencia))
      .sort((a, b) => a.habito_id.localeCompare(b.habito_id));

    return { fecha: fechaReferencia, rachas };
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      throw error;
    }

    throw new RegistroHabitoError(
      "INTERNO",
      "No se pudieron calcular las estadísticas",
    );
  }
}
