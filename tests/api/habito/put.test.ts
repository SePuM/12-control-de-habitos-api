import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const txGet = vi.fn();
  const txSet = vi.fn();
  const docGet = vi.fn();
  const runTransaction = vi.fn(
    async (
      callback: (transaccion: {
        get: typeof txGet;
        set: typeof txSet;
      }) => Promise<unknown>,
    ) => callback({ get: txGet, set: txSet }),
  );
  const docHabito = vi.fn((id: string) => ({ id, get: docGet }));
  const collectionHabito = { doc: docHabito };
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
  const firestore = { collection, runTransaction };
  const getAdminFirestore = vi.fn(() => firestore);
  const getAdminAuth = vi.fn(() => ({ verifyIdToken }));

  return {
    verifyIdToken,
    txGet,
    txSet,
    docGet,
    runTransaction,
    docHabito,
    docUsuario,
    collection,
    getAdminAuth,
    getAdminFirestore,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: mocks.getAdminAuth,
  getAdminFirestore: mocks.getAdminFirestore,
}));

const ID_HABITO = "habito-123";
const TOKEN_VALIDO = "token-valido";
const UID_TOKEN = "uid-token-123";
const FECHA_CREADO = Timestamp.fromDate(new Date("2026-01-10T10:00:00.000Z"));
const FECHA_ACTUALIZADO = Timestamp.fromDate(
  new Date("2026-01-10T11:00:00.000Z"),
);
const FECHA_ELIMINADO = Timestamp.fromDate(
  new Date("2026-01-09T09:00:00.000Z"),
);
const ISO_CREADO = "2026-01-10T10:00:00.000Z";
const ISO_ACTUALIZADO = "2026-01-10T11:00:00.000Z";
const HABITO_VALIDO = {
  nombre: "Leer 10 minutos",
  tipo: "manual",
  meta: 10,
  activo: true,
};
const HABITO_ACTUALIZADO = {
  nombre: "Caminar",
  tipo: "pasos",
  meta: 500,
  activo: false,
};
const DOC_CREADO = {
  ...HABITO_VALIDO,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: null,
};
const DOC_ACTUALIZADO = {
  ...HABITO_ACTUALIZADO,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: null,
};

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

type OpcionesRequest = {
  body?: string | Record<string, unknown>;
  id?: string;
  authorization?: string | null;
};

async function importarModulo() {
  return import("@/app/api/habito/[id]/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.PUT;
}

async function ejecutar(opciones: OpcionesRequest = {}): Promise<Response> {
  const {
    body = HABITO_VALIDO,
    id = ID_HABITO,
    authorization = `Bearer ${TOKEN_VALIDO}`,
  } = opciones;
  const handler = await obtenerHandler();
  const headers = new Headers({ "content-type": "application/json" });

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  const request = new Request(
    `http://localhost:3000/api/habito/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );

  return handler(request, { params: Promise.resolve({ id }) });
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

async function esperar401(respuesta: Response): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
  expect(mocks.runTransaction).not.toHaveBeenCalled();
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

  expect(mocks.runTransaction).not.toHaveBeenCalled();
}

function datosEscritos(): Record<string, unknown> {
  const llamada = mocks.txSet.mock.calls[0];

  return (llamada?.[1] ?? {}) as Record<string, unknown>;
}

describe("PUT /api/habito/[id]", () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockResolvedValue({ uid: UID_TOKEN });
    mocks.txGet.mockResolvedValue({ exists: false, data: () => undefined });
    mocks.txSet.mockResolvedValue(undefined);
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => DOC_CREADO,
    });
    mocks.runTransaction.mockImplementation(async (callback) =>
      callback({ get: mocks.txGet, set: mocks.txSet }),
    );
    mocks.docHabito.mockImplementation((id: string) => ({
      id,
      get: mocks.docGet,
    }));
    mocks.docUsuario.mockImplementation(() => ({
      collection: mocks.collection,
    }));
    mocks.collection.mockImplementation((nombre: string) => {
      if (nombre === "usuarios") {
        return { doc: mocks.docUsuario };
      }

      if (nombre === "habito") {
        return { doc: mocks.docHabito };
      }

      throw new Error(`Colección inesperada: ${nombre}`);
    });
    mocks.getAdminAuth.mockReturnValue({ verifyIdToken: mocks.verifyIdToken });
    mocks.getAdminFirestore.mockReturnValue({
      collection: mocks.collection,
      runTransaction: mocks.runTransaction,
    });
  });

  it("devuelve 401 si falta el header Authorization", async () => {
    const respuesta = await ejecutar({ authorization: null });

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("devuelve 401 si el esquema no es Bearer", async () => {
    const respuesta = await ejecutar({
      authorization: `Basic ${TOKEN_VALIDO}`,
    });

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("devuelve 401 si el token Bearer está vacío", async () => {
    const respuesta = await ejecutar({ authorization: "Bearer" });

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("devuelve 401 si verifyIdToken rechaza el token", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(new Error("token inválido"));
    const respuesta = await ejecutar();

    await esperar401(respuesta);
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(TOKEN_VALIDO);
  });

  it("devuelve un 401 genérico sin filtrar el error de Firebase", async () => {
    mocks.verifyIdToken.mockRejectedValueOnce(
      new Error("detalle interno del token"),
    );
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
    expect(JSON.stringify(cuerpo)).not.toContain("detalle interno del token");
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el body no es JSON válido", async () => {
    const respuesta = await ejecutar({ body: "{ esto no es json" });

    await esperar400(respuesta);
  });

  it("devuelve 400 si falta nombre", async () => {
    const respuesta = await ejecutar({
      body: { tipo: "manual", meta: 10, activo: true },
    });

    await esperar400(respuesta);
  });

  it("devuelve 400 si nombre está fuera del rango 2-40", async () => {
    const nombresInvalidos = ["", "a", "a".repeat(41)];

    for (const nombre of nombresInvalidos) {
      const respuesta = await ejecutar({
        body: { ...HABITO_VALIDO, nombre },
      });

      await esperar400(respuesta);
    }
  });

  it("devuelve 400 si tipo no es manual o pasos", async () => {
    const respuesta = await ejecutar({
      body: { ...HABITO_VALIDO, tipo: "automatico" },
    });

    await esperar400(respuesta);
  });

  it("devuelve 400 si meta no es un entero mayor que 0", async () => {
    const metasInvalidas = [0, -1, 1.5, "10"];

    for (const meta of metasInvalidas) {
      const respuesta = await ejecutar({
        body: { ...HABITO_VALIDO, meta },
      });

      await esperar400(respuesta);
    }
  });

  it("devuelve 400 si tipo pasos y meta está fuera de 500-50000", async () => {
    const metasInvalidas = [499, 50001];

    for (const meta of metasInvalidas) {
      const respuesta = await ejecutar({
        body: { ...HABITO_VALIDO, tipo: "pasos", meta },
      });

      await esperar400(respuesta);
    }
  });

  it("devuelve 400 si activo no es booleano", async () => {
    const valoresInvalidos = [1, "true", null];

    for (const activo of valoresInvalidos) {
      const respuesta = await ejecutar({
        body: { ...HABITO_VALIDO, activo },
      });

      await esperar400(respuesta);
    }
  });

  it("devuelve 400 si se envían campos extra", async () => {
    const respuesta = await ejecutar({
      body: { ...HABITO_VALIDO, admin: true },
    });

    await esperar400(respuesta);
  });

  it("devuelve 400 si el id de ruta está vacío", async () => {
    const respuesta = await ejecutar({ id: "" });

    await esperar400(respuesta);
  });

  it("devuelve 200 y crea el hábito usando el uid del token", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({
      id: ID_HABITO,
      ...HABITO_VALIDO,
      created_at: ISO_CREADO,
      updated_at: ISO_ACTUALIZADO,
      deleted_at: null,
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(TOKEN_VALIDO);
    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
    expect(mocks.collection).toHaveBeenCalledWith("habito");
    expect(mocks.docHabito).toHaveBeenCalledWith(ID_HABITO);
    expect(datosEscritos()).toMatchObject({
      ...HABITO_VALIDO,
      deleted_at: null,
    });
    expect(datosEscritos().created_at).toBeDefined();
    expect(datosEscritos().updated_at).toBeDefined();
    expect(mocks.docGet).toHaveBeenCalledTimes(1);
  });

  it("devuelve 200 y conserva created_at al actualizar", async () => {
    mocks.txGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        created_at: FECHA_CREADO,
        deleted_at: FECHA_ELIMINADO,
      }),
    });
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => DOC_ACTUALIZADO,
    });

    const respuesta = await ejecutar({ body: HABITO_ACTUALIZADO });
    const cuerpo = await leerJson(respuesta);
    const datos = datosEscritos();

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({
      id: ID_HABITO,
      ...HABITO_ACTUALIZADO,
      created_at: ISO_CREADO,
      updated_at: ISO_ACTUALIZADO,
      deleted_at: null,
    });
    expect(datos.created_at).toBe(FECHA_CREADO);
    expect(datos.updated_at).toBeDefined();
    expect(datos.deleted_at).toBeNull();
  });

  it("devuelve 200 de forma idempotente al repetir el mismo PUT", async () => {
    mocks.txGet.mockResolvedValue({
      exists: true,
      data: () => ({ created_at: FECHA_CREADO }),
    });
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => DOC_ACTUALIZADO,
    });

    const primera = await ejecutar({ body: HABITO_ACTUALIZADO });
    const segunda = await ejecutar({ body: HABITO_ACTUALIZADO });

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.txSet).toHaveBeenCalledTimes(2);
    expect(mocks.docHabito).toHaveBeenNthCalledWith(1, ID_HABITO);
    expect(mocks.docHabito).toHaveBeenNthCalledWith(2, ID_HABITO);

    for (const llamada of mocks.txSet.mock.calls) {
      const datos = (llamada[1] ?? {}) as Record<string, unknown>;

      expect(datos.created_at).toBe(FECHA_CREADO);
    }
  });

  it("devuelve 500 genérico si falla Firestore", async () => {
    mocks.runTransaction.mockRejectedValueOnce(new Error("firestore caído"));
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("firestore caído");
  });

  it("no escribe en Firestore si falla la autenticación o validación", async () => {
    const sinToken = await ejecutar({ authorization: null });
    const cuerpoInvalido = await ejecutar({
      body: { nombre: "a" },
    });

    expect(sinToken.status).toBe(401);
    expect(cuerpoInvalido.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it("no exporta runtime y rechaza uid enviado en el body", async () => {
    const modulo = await importarModulo();
    const respuesta = await ejecutar({
      body: { ...HABITO_VALIDO, uid: "uid-atacante" },
    });

    expect("runtime" in modulo).toBe(false);
    expect(respuesta.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});
