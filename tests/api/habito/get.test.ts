import { Timestamp } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const queryGet = vi.fn();
  const where = vi.fn(() => ({ get: queryGet }));
  const collectionHabito = { get: queryGet, where };
  const docUsuario = vi.fn(() => ({ collection }));
  const collectionUsuarios = { doc: docUsuario };
  const collection = vi.fn((nombre: string) => {
    if (nombre === "usuarios") {
      return collectionUsuarios;
    }

    if (nombre === "habito") {
      return collectionHabito;
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

const URL_HABITOS = "http://localhost:3000/api/habito";
const TOKEN_VALIDO = "token-valido";
const UID_TOKEN = "uid-token-123";
const SINCE_ISO = "2026-01-10T00:00:00.000Z";
const FECHA_CREADO = Timestamp.fromDate(new Date("2026-01-09T08:00:00.000Z"));
const FECHA_ACTUALIZADO = Timestamp.fromDate(
  new Date("2026-01-10T11:00:00.000Z"),
);
const FECHA_ELIMINADO = Timestamp.fromDate(
  new Date("2026-01-09T09:00:00.000Z"),
);
const ISO_CREADO = "2026-01-09T08:00:00.000Z";
const ISO_ACTUALIZADO = "2026-01-10T11:00:00.000Z";
const ISO_ELIMINADO = "2026-01-09T09:00:00.000Z";
const ID_ACTIVO = "habito-activo";
const ID_ELIMINADO = "habito-eliminado";
const ID_ELIMINADO_RECIENTE = "habito-eliminado-reciente";
const HABITO_ACTIVO_FIRESTORE = {
  nombre: "Leer",
  tipo: "manual",
  meta: 10,
  activo: true,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: null,
};
const HABITO_ELIMINADO_FIRESTORE = {
  nombre: "Caminar",
  tipo: "pasos",
  meta: 1000,
  activo: false,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ELIMINADO,
  deleted_at: FECHA_ELIMINADO,
};
const HABITO_ELIMINADO_RECIENTE_FIRESTORE = {
  ...HABITO_ELIMINADO_FIRESTORE,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: FECHA_ACTUALIZADO,
};
const DOC_ACTIVO = {
  id: ID_ACTIVO,
  nombre: "Leer",
  tipo: "manual",
  meta: 10,
  activo: true,
  created_at: ISO_CREADO,
  updated_at: ISO_ACTUALIZADO,
  deleted_at: null,
};
const DOC_ELIMINADO = {
  id: ID_ELIMINADO,
  nombre: "Caminar",
  tipo: "pasos",
  meta: 1000,
  activo: false,
  created_at: ISO_CREADO,
  updated_at: ISO_ELIMINADO,
  deleted_at: ISO_ELIMINADO,
};
const DOC_ELIMINADO_RECIENTE = {
  ...DOC_ELIMINADO,
  id: ID_ELIMINADO_RECIENTE,
  updated_at: ISO_ACTUALIZADO,
  deleted_at: ISO_ACTUALIZADO,
};

type Handler = (request: NextRequest) => Promise<Response>;

type OpcionesRequest = {
  since?: string;
  authorization?: string | null;
};

function documentoFirestore(
  id: string,
  datos: Record<string, unknown>,
): { id: string; data: () => Record<string, unknown> } {
  return { id, data: () => datos };
}

async function importarModulo() {
  return import("@/app/api/habito/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.GET;
}

function crearRequest(opciones: OpcionesRequest = {}): NextRequest {
  const {
    since,
    authorization = `Bearer ${TOKEN_VALIDO}`,
  } = opciones;
  const url = new URL(URL_HABITOS);
  const headers = new Headers();

  if (since !== undefined) {
    url.searchParams.set("since", since);
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

async function leerObjeto(respuesta: Response): Promise<Record<string, unknown>> {
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
  const cuerpo = await leerObjeto(respuesta);

  expect(respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
  expect(mocks.queryGet).not.toHaveBeenCalled();
  expect(mocks.where).not.toHaveBeenCalled();
}

async function esperar400(respuesta: Response): Promise<void> {
  const cuerpo = await leerObjeto(respuesta);
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

describe("GET /api/habito", () => {
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

      if (nombre === "habito") {
        return { get: mocks.queryGet, where: mocks.where };
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
    const cuerpo = await leerObjeto(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
    expect(JSON.stringify(cuerpo)).not.toContain("detalle interno del token");
    expect(mocks.queryGet).not.toHaveBeenCalled();
  });

  it("devuelve 400 si since no es una fecha ISO 8601 válida", async () => {
    const respuesta = await ejecutar({ since: "no-es-fecha" });

    await esperar400(respuesta);
  });

  it("devuelve 400 si since está vacío", async () => {
    const respuesta = await ejecutar({ since: "" });

    await esperar400(respuesta);
  });

  it("devuelve 400 si since es solo fecha sin hora", async () => {
    const respuesta = await ejecutar({ since: "2026-01-10" });

    await esperar400(respuesta);
  });

  it("devuelve 200 sin since con la lista completa", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(ID_ACTIVO, HABITO_ACTIVO_FIRESTORE),
        documentoFirestore(ID_ELIMINADO, HABITO_ELIMINADO_FIRESTORE),
      ],
    });

    const respuesta = await ejecutar();
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ACTIVO, DOC_ELIMINADO]);
    expect(mocks.where).not.toHaveBeenCalled();
    expect(mocks.queryGet).toHaveBeenCalledTimes(1);
    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
    expect(mocks.collection).toHaveBeenCalledWith("habito");
  });

  it("incluye documentos con deleted_at != null en la lista completa", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [documentoFirestore(ID_ELIMINADO, HABITO_ELIMINADO_FIRESTORE)],
    });

    const respuesta = await ejecutar();
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ELIMINADO]);
    expect(cuerpo).toContainEqual(
      expect.objectContaining({ deleted_at: ISO_ELIMINADO }),
    );
  });

  it("serializa los Timestamp de Firestore a strings ISO 8601", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [documentoFirestore(ID_ACTIVO, HABITO_ACTIVO_FIRESTORE)],
    });

    const respuesta = await ejecutar();
    const cuerpo = await leerArreglo(respuesta);
    const [documento] = cuerpo;

    expect(respuesta.status).toBe(200);
    expect(documento).toEqual(DOC_ACTIVO);
    expect(JSON.stringify(cuerpo)).not.toContain("_seconds");
  });

  it("consulta updated_at >= since cuando viene el parámetro", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [documentoFirestore(ID_ACTIVO, HABITO_ACTIVO_FIRESTORE)],
    });

    const respuesta = await ejecutar({ since: SINCE_ISO });
    const cuerpo = await leerArreglo(respuesta);
    const llamada = mocks.where.mock.calls[0];
    const valor = llamada?.[2];

    expect(respuesta.status).toBe(200);
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(llamada?.[0]).toBe("updated_at");
    expect(llamada?.[1]).toBe(">=");
    expect(valor).toBeInstanceOf(Timestamp);

    if (valor instanceof Timestamp) {
      expect(valor.toDate().toISOString()).toBe(SINCE_ISO);
    }

    expect(cuerpo).toEqual([DOC_ACTIVO]);
  });

  it("devuelve solo los documentos filtrados con since", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(ID_ACTIVO, HABITO_ACTIVO_FIRESTORE),
        documentoFirestore(
          ID_ELIMINADO_RECIENTE,
          HABITO_ELIMINADO_RECIENTE_FIRESTORE,
        ),
      ],
    });

    const respuesta = await ejecutar({ since: SINCE_ISO });
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ACTIVO, DOC_ELIMINADO_RECIENTE]);
  });

  it("incluye eliminados que cumplan el filtro since", async () => {
    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        documentoFirestore(
          ID_ELIMINADO_RECIENTE,
          HABITO_ELIMINADO_RECIENTE_FIRESTORE,
        ),
      ],
    });

    const respuesta = await ejecutar({ since: SINCE_ISO });
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([DOC_ELIMINADO_RECIENTE]);
    expect(cuerpo).toContainEqual(
      expect.objectContaining({ deleted_at: ISO_ACTUALIZADO }),
    );
  });

  it("devuelve 200 con un arreglo vacío si no hay documentos", async () => {
    mocks.queryGet.mockResolvedValueOnce({ docs: [] });

    const respuesta = await ejecutar();
    const cuerpo = await leerArreglo(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual([]);
  });

  it("devuelve 500 genérico si falla Firestore", async () => {
    mocks.queryGet.mockRejectedValueOnce(new Error("firestore caído"));
    const respuesta = await ejecutar();
    const cuerpo = await leerObjeto(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("firestore caído");
  });

  it("no consulta Firestore si falla la autenticación o validación", async () => {
    const sinToken = await ejecutar({ authorization: null });
    const sinceInvalido = await ejecutar({ since: "no-es-fecha" });

    expect(sinToken.status).toBe(401);
    expect(sinceInvalido.status).toBe(400);
    expect(mocks.queryGet).not.toHaveBeenCalled();
    expect(mocks.where).not.toHaveBeenCalled();
  });

  it("usa el uid del token en la ruta de Firestore", async () => {
    mocks.queryGet.mockResolvedValueOnce({ docs: [] });

    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(200);
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
  });
});
