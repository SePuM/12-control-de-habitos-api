import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const obtenerEstadisticasRachas = vi.fn();
  const getAdminAuth = vi.fn(() => ({ verifyIdToken }));
  const getAdminFirestore = vi.fn();

  return {
    verifyIdToken,
    obtenerEstadisticasRachas,
    getAdminAuth,
    getAdminFirestore,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: mocks.getAdminAuth,
  getAdminFirestore: mocks.getAdminFirestore,
}));

vi.mock("@/lib/services/estadisticas-habito", () => ({
  obtenerEstadisticasRachas: mocks.obtenerEstadisticasRachas,
}));

const URL_ESTADISTICAS =
  "http://localhost:3000/api/registro_habito/estadisticas";
const TOKEN_VALIDO = "token-valido";
const UID_TOKEN = "uid-token-123";
const FECHA = "2026-11-21";
const RESPUESTA = {
  fecha: FECHA,
  rachas: [
    {
      habito_id: "habito-123",
      nombre: "Leer",
      meta: 2,
      activo: true,
      racha_actual: 3,
      ultima_fecha_completada: FECHA,
    },
  ],
};

type Handler = (request: NextRequest) => Promise<Response>;

type OpcionesRequest = {
  fecha?: string;
  authorization?: string | null;
  parametros?: Record<string, string>;
};

async function importarModulo() {
  return import("@/app/api/registro_habito/estadisticas/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();

  return modulo.GET;
}

function crearRequest(opciones: OpcionesRequest = {}): NextRequest {
  const {
    fecha,
    authorization = `Bearer ${TOKEN_VALIDO}`,
    parametros = {},
  } = opciones;
  const url = new URL(URL_ESTADISTICAS);
  const headers = new Headers();

  if (fecha !== undefined) {
    url.searchParams.set("fecha", fecha);
  }

  for (const [clave, valor] of Object.entries(parametros)) {
    url.searchParams.set(clave, valor);
  }

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  return new NextRequest(url, { method: "GET", headers });
}

async function ejecutar(opciones: OpcionesRequest = {}): Promise<Response> {
  const handler = await obtenerHandler();

  return handler(crearRequest(opciones));
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

describe("GET /api/registro_habito/estadisticas", () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset();
    mocks.verifyIdToken.mockResolvedValue({ uid: UID_TOKEN });
    mocks.obtenerEstadisticasRachas.mockReset();
    mocks.obtenerEstadisticasRachas.mockResolvedValue(RESPUESTA);
  });

  it("devuelve 401 si falta el header Authorization", async () => {
    const respuesta = await ejecutar({ authorization: null });

    expect(respuesta.status).toBe(401);
    expect(await leerJson(respuesta)).toEqual({
      error: "No autorizado",
      detalles: [],
    });
    expect(mocks.obtenerEstadisticasRachas).not.toHaveBeenCalled();
  });

  it("devuelve 401 si verifyIdToken rechaza el token", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("token inválido"));

    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(401);
    expect(mocks.obtenerEstadisticasRachas).not.toHaveBeenCalled();
  });

  it("devuelve un 401 genérico sin filtrar el detalle interno", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("secreto interno"));

    const respuesta = await ejecutar();

    expect(await leerJson(respuesta)).toEqual({
      error: "No autorizado",
      detalles: [],
    });
  });

  it("devuelve 400 si fecha no es una fecha YYYY-MM-DD real", async () => {
    const respuesta = await ejecutar({ fecha: "2026-02-30" });

    expect(respuesta.status).toBe(400);
    expect(await leerJson(respuesta)).toEqual({
      error: "Datos inválidos",
      detalles: [{ campo: "fecha", mensaje: "Invalid ISO date" }],
    });
    expect(mocks.obtenerEstadisticasRachas).not.toHaveBeenCalled();
  });

  it("devuelve 400 si hay parámetros de consulta desconocidos", async () => {
    const respuesta = await ejecutar({ parametros: { foo: "bar" } });

    expect(respuesta.status).toBe(400);
    expect(await leerJson(respuesta)).toEqual({
      error: "Datos inválidos",
      detalles: [{ campo: "body", mensaje: 'Unrecognized key: "foo"' }],
    });
    expect(mocks.obtenerEstadisticasRachas).not.toHaveBeenCalled();
  });

  it("devuelve 200 con las estadísticas y respeta la fecha recibida", async () => {
    const respuesta = await ejecutar({ fecha: FECHA });

    expect(respuesta.status).toBe(200);
    expect(await leerJson(respuesta)).toEqual(RESPUESTA);
    expect(mocks.obtenerEstadisticasRachas).toHaveBeenCalledWith(
      UID_TOKEN,
      FECHA,
    );
  });

  it("no envía fecha al servicio si el cliente no la aporta", async () => {
    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(200);
    expect(mocks.obtenerEstadisticasRachas).toHaveBeenCalledWith(
      UID_TOKEN,
      undefined,
    );
  });

  it("devuelve 500 genérico si falla el servicio", async () => {
    mocks.obtenerEstadisticasRachas.mockRejectedValueOnce(
      new Error("secreto interno"),
    );

    const respuesta = await ejecutar({ fecha: FECHA });

    expect(respuesta.status).toBe(500);
    expect(await leerJson(respuesta)).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
  });

  it("no consulta el servicio si falla la autenticación o validación", async () => {
    await ejecutar({ authorization: null });

    await ejecutar({ fecha: "fecha-invalida" });

    expect(mocks.obtenerEstadisticasRachas).not.toHaveBeenCalled();
  });

  it("exporta GET y no exporta runtime", async () => {
    const modulo = await importarModulo();

    expect(modulo).toHaveProperty("GET");
    expect(modulo).not.toHaveProperty("runtime");
  });
});
