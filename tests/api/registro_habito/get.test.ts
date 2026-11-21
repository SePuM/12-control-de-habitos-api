import { Timestamp } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const queryGet = vi.fn();
  const where = vi.fn((campo: string, operador: string, valor: unknown) => {
    if (!campo || !operador || valor === undefined) {
      throw new Error("Consulta where incompleta");
    }

    return { get: queryGet };
  });
  const collectionRegistro = { where };
  const docUsuario = vi.fn(() => ({ collection }));
  const collectionUsuarios = { doc: docUsuario };
  const collection = vi.fn((nombre: string) => {
    if (nombre === "usuarios") {
      return collectionUsuarios;
    }

    if (nombre === "registro_habito") {
      return collectionRegistro;
    }

    throw new Error(`Colección inesperada: ${nombre}`);
  });
  const getAdminFirestore = vi.fn(() => ({ collection }));
  const getAdminAuth = vi.fn(() => ({ verifyIdToken }));

  return {
    verifyIdToken,
    queryGet,
    where,
    docUsuario,
    collection,
    getAdminFirestore,
    getAdminAuth,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: mocks.getAdminAuth,
  getAdminFirestore: mocks.getAdminFirestore,
}));

const URL_REGISTROS = "http://localhost:3000/api/registro_habito";
const TOKEN_VALIDO = "token-valido";
const UID_TOKEN = "uid-token-123";
const FECHA = "2026-11-20";
const ID_HABITO = "habito-123";
const FECHA_CREADO = Timestamp.fromDate(new Date("2026-11-20T08:00:00.000Z"));
const FECHA_ACTUALIZADO = Timestamp.fromDate(
  new Date("2026-11-20T09:00:00.000Z"),
);
const FECHA_ELIMINADO = Timestamp.fromDate(
  new Date("2026-11-20T10:00:00.000Z"),
);
const ISO_CREADO = "2026-11-20T08:00:00.000Z";
const ISO_ACTUALIZADO = "2026-11-20T09:00:00.000Z";
const ISO_ELIMINADO = "2026-11-20T10:00:00.000Z";
const REGISTRO_ACTIVO_FIRESTORE = {
  habito_id: ID_HABITO,
  fecha: FECHA,
  cantidad: 10,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: null,
};
const REGISTRO_ELIMINADO_FIRESTORE = {
  habito_id: "habito-eliminado",
  fecha: FECHA,
  cantidad: 0,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ELIMINADO,
  deleted_at: FECHA_ELIMINADO,
};
const DOC_ACTIVO = {
  id: `${ID_HABITO}_${FECHA}`,
  habito_id: ID_HABITO,
  fecha: FECHA,
  cantidad: 10,
  created_at: ISO_CREADO,
  updated_at: ISO_ACTUALIZADO,
  deleted_at: null,
};
const DOC_ELIMINADO = {
  id: `habito-eliminado_${FECHA}`,
  habito_id: "habito-eliminado",
  fecha: FECHA,
  cantidad: 0,
  created_at: ISO_CREADO,
  updated_at: ISO_ELIMINADO,
  deleted_at: ISO_ELIMINADO,
};

type Handler = (request: NextRequest) => Promise<Response>;

type OpcionesRequest = {
  fecha?: string;
  authorization?: string | null;
};

async function importarModulo() {
  return import("@/app/api/registro_habito/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.GET;
}

function crearRequest(opciones: OpcionesRequest = {}): NextRequest {
  const { fecha, authorization = `Bearer ${TOKEN_VALIDO}` } = opciones;
  const url = new URL(URL_REGISTROS);
  const headers = new Headers();

  if (fecha !== undefined) {
    url.searchParams.set("fecha", fecha);
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

async function leerArreglo(respuesta: Response): Promise<unknown[]> {
  const cuerpo: unknown = await respuesta.json();

  if (!Array.isArray(cuerpo)) {
    throw new Error("La respuesta no es un arreglo JSON");
  }

  return cuerpo;
}

async function esperar401(respuesta: Response): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
  expect(mocks.queryGet).not.toHaveBeenCalled();
  expect(mocks.where).not.toHaveBeenCalled();
}

async function esperar400(respuesta: Response): Promise<void> {
  const cuerpo = await leerJson(respuesta);
  const detalles = cuerpo.detalles;

  expect(respuesta.status).toBe(400);
  expect(cuerpo.error).toBe("Datos inválidos");
  expect(Array.isArray(detalles)).toBe(true);

  if (Array.isArray(detalles)) {
    expect(detalles.length).toBeGreaterThan(0);
  }

  expect(mocks.queryGet).not.toHaveBeenCalled();
  expect(mocks.where).not.toHaveBeenCalled();
}

function documentoFirestore(
  id: string,
  datos: Record<string, unknown>,
): { id: string; data: () => Record<string, unknown> } {
  return { id, data: () => datos };
}

describe("GET /api/registro_habito", () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockResolvedValue({ uid: UID_TOKEN });
    mocks.queryGet.mockResolvedValue({ docs: [] });
    mocks.where.mockImplementation(() => ({ get: mocks.queryGet }));
    mocks.docUsuario.mockImplementation(() => ({
      collection: mocks.collection,
    }));
    mocks.collection.mockImplementation((nombre: string) => {
      if (nombre === "usuarios") {
        return { doc: mocks.docUsuario };
      }

      if (nombre === "registro_habito") {
        return { where: mocks.where };
      }

      throw new Error(`Colección inesperada: ${nombre}`);
    });
    mocks.getAdminAuth.mockReturnValue({ verifyIdToken: mocks.verifyIdToken });
    mocks.getAdminFirestore.mockReturnValue({
      collection: mocks.collection,
    });
  });

  it("devuelve 401 si falta el header Authorization", async () => {
    const respuesta = await ejecutar({ authorization: null });

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("devuelve 401 si verifyIdToken rechaza el token", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("token inválido"));
    const respuesta = await ejecutar();

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(TOKEN_VALIDO);
  });

  it("devuelve un 401 genérico sin filtrar el detalle interno", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(
      new Error("detalle interno del token"),
    );
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
    expect(JSON.stringify(cuerpo)).not.toContain("detalle interno del token");
    expect(mocks.queryGet).not.toHaveBeenCalled();
  });

  it("devuelve 400 si falta el parámetro fecha", async () => {
    const respuesta = await ejecutar();

    await esperar400(respuesta);
  });

  it("devuelve 400 si fecha no es una fecha YYYY-MM-DD real", async () => {
    const fechasInvalidas = [
      "",
      "2026-02-30",
      "20-11-2026",
      "2026-11-20T00:00:00.000Z",
    ];

    for (const fecha of fechasInvalidas) {
      const respuesta = await ejecutar({ fecha });

      await esperar400(respuesta);
    }
  });

  it("devuelve 200 con un arreglo vacío si no hay registros", async () => {
    const respuesta = await ejecutar({ fecha: FECHA });
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([]);
  });

  it("consulta por fecha usando el uid del token", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(`${ID_HABITO}_${FECHA}`, REGISTRO_ACTIVO_FIRESTORE),
      ],
    });

    const respuesta = await ejecutar({ fecha: FECHA });
    const cuerpo = await leerArreglo(respuesta);
    const llamada = mocks.where.mock.calls[0];

    expect(respuesta.status).toBe(200);
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(llamada?.[0]).toBe("fecha");
    expect(llamada?.[1]).toBe("==");
    expect(llamada?.[2]).toBe(FECHA);
    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
    expect(mocks.collection).toHaveBeenCalledWith("registro_habito");
    expect(cuerpo).toEqual([DOC_ACTIVO]);
  });

  it("incluye registros con deleted_at != null para sincronización", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(`${ID_HABITO}_${FECHA}`, REGISTRO_ACTIVO_FIRESTORE),
        documentoFirestore(
          `habito-eliminado_${FECHA}`,
          REGISTRO_ELIMINADO_FIRESTORE,
        ),
      ],
    });

    const respuesta = await ejecutar({ fecha: FECHA });
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ACTIVO, DOC_ELIMINADO]);
    expect(cuerpo).toContainEqual(
      expect.objectContaining({ deleted_at: ISO_ELIMINADO }),
    );
  });

  it("serializa los Timestamp de Firestore a ISO 8601", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(`${ID_HABITO}_${FECHA}`, REGISTRO_ACTIVO_FIRESTORE),
      ],
    });

    const respuesta = await ejecutar({ fecha: FECHA });
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ACTIVO]);
    expect(JSON.stringify(cuerpo)).not.toContain("_seconds");
  });

  it("devuelve 500 genérico si falla Firestore", async () => {
    mocks.queryGet.mockRejectedValueOnce(new Error("firestore caído"));
    const respuesta = await ejecutar({ fecha: FECHA });
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("firestore caído");
  });

  it("no consulta Firestore si falla la autenticación o validación", async () => {
    const sinToken = await ejecutar({ fecha: FECHA, authorization: null });
    const fechaInvalida = await ejecutar({ fecha: "2026-02-30" });

    expect(sinToken.status).toBe(401);
    expect(fechaInvalida.status).toBe(400);
    expect(mocks.queryGet).not.toHaveBeenCalled();
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it("exporta GET y no exporta runtime", async () => {
    const modulo = await importarModulo();

    expect(modulo).toHaveProperty("GET");
    expect("runtime" in modulo).toBe(false);
  });
});
