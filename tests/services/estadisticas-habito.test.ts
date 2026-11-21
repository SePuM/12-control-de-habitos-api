import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const habitosGet = vi.fn(async () => ({ docs: [] as unknown[] }));
  const registrosGet = vi.fn(async () => ({ docs: [] as unknown[] }));
  const collection = vi.fn((nombre: string) => {
    if (nombre === "usuarios") {
      return { doc: docUsuario };
    }

    if (nombre === "habito") {
      return { get: habitosGet };
    }

    if (nombre === "registro_habito") {
      return { get: registrosGet };
    }

    throw new Error(`Colección inesperada: ${nombre}`);
  });
  const docUsuario = vi.fn(() => ({ collection }));
  const getAdminFirestore = vi.fn(() => ({ collection }));

  return {
    habitosGet,
    registrosGet,
    collection,
    docUsuario,
    getAdminFirestore,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: vi.fn(),
  getAdminFirestore: mocks.getAdminFirestore,
}));

const UID = "uid-token-123";
const FECHA_REFERENCIA = "2026-11-21";
const ELIMINADO = "2026-11-20T10:00:00.000Z";

type Datos = Record<string, unknown>;

type ModuloEstadisticas = typeof import("@/lib/services/estadisticas-habito");

function documento(id: string, datos: Datos) {
  return { id, exists: true, data: () => datos };
}

function habito(
  id: string,
  meta = 1,
  deleted_at: string | null = null,
  nombre = id,
) {
  return documento(id, {
    nombre,
    tipo: "manual",
    meta,
    activo: true,
    created_at: null,
    updated_at: null,
    deleted_at,
  });
}

function registro(
  habitoId: string,
  fecha: string,
  cantidad: number,
  deleted_at: string | null = null,
) {
  return documento(`${habitoId}_${fecha}`, {
    habito_id: habitoId,
    fecha,
    cantidad,
    created_at: null,
    updated_at: null,
    deleted_at,
  });
}

function configurar(habitos: unknown[], registros: unknown[]): void {
  mocks.habitosGet.mockResolvedValue({ docs: habitos });
  mocks.registrosGet.mockResolvedValue({ docs: registros });
}

async function obtenerServicio(): Promise<ModuloEstadisticas> {
  return import("@/lib/services/estadisticas-habito");
}

async function calcular(fecha?: string) {
  const { obtenerEstadisticasRachas } = await obtenerServicio();

  return obtenerEstadisticasRachas(UID, fecha);
}

describe("obtenerEstadisticasRachas", () => {
  beforeEach(() => {
    mocks.habitosGet.mockReset();
    mocks.registrosGet.mockReset();
    mocks.collection.mockClear();
    mocks.docUsuario.mockClear();
    mocks.getAdminFirestore.mockClear();
    configurar([], []);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calcula la racha incluyendo hoy", async () => {
    configurar(
      [habito("h1", 2)],
      [
        registro("h1", "2026-11-21", 2),
        registro("h1", "2026-11-20", 3),
        registro("h1", "2026-11-19", 2),
        registro("h1", "2026-11-18", 1),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado).toEqual({
      fecha: FECHA_REFERENCIA,
      rachas: [
        {
          habito_id: "h1",
          nombre: "h1",
          meta: 2,
          activo: true,
          racha_actual: 3,
          ultima_fecha_completada: "2026-11-21",
        },
      ],
    });
  });

  it("mantiene la racha hasta ayer si hoy no está completado", async () => {
    configurar(
      [habito("h1")],
      [
        registro("h1", "2026-11-21", 0),
        registro("h1", "2026-11-20", 1),
        registro("h1", "2026-11-19", 1),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.racha_actual).toBe(2);
    expect(resultado.rachas[0]?.ultima_fecha_completada).toBe("2026-11-20");
  });

  it("devuelve racha 0 si ni hoy ni ayer están completados", async () => {
    configurar(
      [habito("h1")],
      [registro("h1", "2026-11-19", 1), registro("h1", "2026-11-18", 1)],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.racha_actual).toBe(0);
    expect(resultado.rachas[0]?.ultima_fecha_completada).toBeNull();
  });

  it("ignora cantidad menor que la meta", async () => {
    configurar(
      [habito("h1", 3)],
      [
        registro("h1", "2026-11-21", 2),
        registro("h1", "2026-11-20", 3),
        registro("h1", "2026-11-19", 4),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.racha_actual).toBe(2);
    expect(resultado.rachas[0]?.ultima_fecha_completada).toBe("2026-11-20");
  });

  it("usa meta 1 si la meta no es positiva", async () => {
    configurar(
      [habito("h1", 0)],
      [registro("h1", "2026-11-21", 1), registro("h1", "2026-11-20", 1)],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.meta).toBe(1);
    expect(resultado.rachas[0]?.racha_actual).toBe(2);
  });

  it("ignora registros borrados", async () => {
    configurar(
      [habito("h1")],
      [
        registro("h1", "2026-11-21", 1, ELIMINADO),
        registro("h1", "2026-11-20", 1),
        registro("h1", "2026-11-19", 1),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.racha_actual).toBe(2);
    expect(resultado.rachas[0]?.ultima_fecha_completada).toBe("2026-11-20");
  });

  it("excluye hábitos borrados y sus registros", async () => {
    configurar(
      [habito("h1"), habito("h2", 1, ELIMINADO)],
      [
        registro("h1", "2026-11-21", 1),
        registro("h2", "2026-11-21", 1),
        registro("h2", "2026-11-20", 1),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas).toHaveLength(1);
    expect(resultado.rachas[0]?.habito_id).toBe("h1");
  });

  it("ignora fechas posteriores a la fecha de referencia", async () => {
    configurar(
      [habito("h1")],
      [
        registro("h1", "2026-11-22", 1),
        registro("h1", "2026-11-21", 1),
        registro("h1", "2026-11-20", 1),
      ],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas[0]?.racha_actual).toBe(2);
    expect(resultado.rachas[0]?.ultima_fecha_completada).toBe("2026-11-21");
  });

  it("usa la fecha UTC actual si no se envía fecha", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T23:30:00.000Z"));
    configurar(
      [habito("h1")],
      [registro("h1", "2026-11-21", 1), registro("h1", "2026-11-20", 1)],
    );

    const resultado = await calcular();

    expect(resultado.fecha).toBe(FECHA_REFERENCIA);
    expect(resultado.rachas[0]?.racha_actual).toBe(2);
  });

  it("ordena las rachas por habito_id", async () => {
    configurar(
      [habito("b"), habito("a")],
      [registro("a", "2026-11-21", 1), registro("b", "2026-11-21", 1)],
    );

    const resultado = await calcular(FECHA_REFERENCIA);

    expect(resultado.rachas.map((racha) => racha.habito_id)).toEqual([
      "a",
      "b",
    ]);
  });
});
