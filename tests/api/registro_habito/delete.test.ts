import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const txGet = vi.fn();
  const txUpdate = vi.fn();
  const docGet = vi.fn();
  const runTransaction = vi.fn(
    async (
      callback: (transaccion: {
        get: typeof txGet;
        update: typeof txUpdate;
      }) => Promise<unknown>,
    ) => callback({ get: txGet, update: txUpdate }),
  );
  const docHabito = vi.fn((id: string) => ({ id, tipo: "habito" }));
  const docRegistro = vi.fn((id: string) => ({ id, tipo: "registro" }));
  const collectionHabito = { doc: docHabito };
  const collectionRegistro = { doc: docRegistro };
  const docUsuario = vi.fn(() => ({ collection }));
  const collectionUsuarios = { doc: docUsuario };
  const collection = vi.fn((nombre: string) => {
    if (nombre === "usuarios") {
      return collectionUsuarios;
    }

    if (nombre === "habito") {
      return collectionHabito;
    }

    if (nombre === "registro_habito") {
      return collectionRegistro;
    }

    throw new Error(`Colección inesperada: ${nombre}`);
  });
  const firestore = { collection, runTransaction };
  const getAdminFirestore = vi.fn(() => firestore);
  const getAdminAuth = vi.fn(() => ({ verifyIdToken }));

  return {
    verifyIdToken,
    txGet,
    txUpdate,
    docGet,
    runTransaction,
    docHabito,
    docRegistro,
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
const FECHA = "2026-11-20";
const CANTIDAD = 10;
const TOKEN_VALIDO = "token-valido";
const UID_TOKEN = "uid-token-123";
const FECHA_CREADO = Timestamp.fromDate(new Date("2026-11-20T08:00:00.000Z"));
const FECHA_ACTUALIZADO = Timestamp.fromDate(
  new Date("2026-11-20T09:00:00.000Z"),
);
const FECHA_ELIMINADO = Timestamp.fromDate(
  new Date("2026-11-20T10:00:00.000Z"),
);
const ISO_CREADO = "2026-11-20T08:00:00.000Z";
const ISO_ACTUALIZADO = "2026-11-20T09:00:00.000Z";
const HABITO_FIRESTORE = {
  nombre: "Leer",
  tipo: "manual",
  meta: 10,
  activo: true,
  deleted_at: null,
};
const REGISTRO_FIRESTORE = {
  habito_id: ID_HABITO,
  fecha: FECHA,
  cantidad: CANTIDAD,
  created_at: FECHA_CREADO,
  updated_at: FECHA_ACTUALIZADO,
  deleted_at: FECHA_ELIMINADO,
};
const DOC_BORRADO = {
  id: `${ID_HABITO}_${FECHA}`,
  habito_id: ID_HABITO,
  fecha: FECHA,
  cantidad: CANTIDAD,
  created_at: ISO_CREADO,
  updated_at: ISO_ACTUALIZADO,
  deleted_at: ISO_ACTUALIZADO,
};

type Handler = (
  request: Request,
  context: { params: Promise<{ habitoId: string; fecha: string }> },
) => Promise<Response>;

type OpcionesRequest = {
  habitoId?: string;
  fecha?: string;
  authorization?: string | null;
};

async function importarModulo() {
  return import("@/app/api/registro_habito/[habitoId]/[fecha]/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.DELETE;
}

function crearRequest(opciones: OpcionesRequest = {}): {
  request: Request;
  habitoId: string;
  fecha: string;
} {
  const {
    habitoId = ID_HABITO,
    fecha = FECHA,
    authorization = `Bearer ${TOKEN_VALIDO}`,
  } = opciones;
  const headers = new Headers();

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  return {
    habitoId,
    fecha,
    request: new Request(
      `http://localhost:3000/api/registro_habito/${encodeURIComponent(habitoId)}/${encodeURIComponent(fecha)}`,
      {
        method: "DELETE",
        headers,
      },
    ),
  };
}

async function ejecutar(opciones: OpcionesRequest = {}): Promise<Response> {
  const handler = await obtenerHandler();
  const { request, habitoId, fecha } = crearRequest(opciones);

  return handler(request, { params: Promise.resolve({ habitoId, fecha }) });
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

async function esperar401(respuesta: Response): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
  expect(mocks.runTransaction).not.toHaveBeenCalled();
  expect(mocks.txUpdate).not.toHaveBeenCalled();
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
  expect(mocks.txUpdate).not.toHaveBeenCalled();
}

async function esperar404(
  respuesta: Response,
  mensaje = "Hábito no encontrado",
): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(404);
  expect(cuerpo).toEqual({ error: mensaje, detalles: [] });
  expect(mocks.txUpdate).not.toHaveBeenCalled();
  expect(mocks.docGet).not.toHaveBeenCalled();
}

describe("DELETE /api/registro_habito/[habitoId]/[fecha]", () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockResolvedValue({ uid: UID_TOKEN });
    mocks.txGet.mockImplementation(
      async (referencia: { tipo?: string } | undefined) => {
        if (referencia?.tipo === "habito") {
          return { exists: true, data: () => HABITO_FIRESTORE };
        }

        return { exists: true, data: () => REGISTRO_FIRESTORE };
      },
    );
    mocks.txUpdate.mockResolvedValue(undefined);
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => DOC_BORRADO,
    });
    mocks.runTransaction.mockImplementation(async (callback) =>
      callback({ get: mocks.txGet, update: mocks.txUpdate }),
    );
    mocks.docHabito.mockImplementation((id: string) => ({
      id,
      tipo: "habito",
    }));
    mocks.docRegistro.mockImplementation((id: string) => ({
      id,
      tipo: "registro",
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

      if (nombre === "registro_habito") {
        return { doc: mocks.docRegistro };
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

  it("devuelve 400 si habitoId es inválido", async () => {
    const idsInvalidos = ["", "id con espacios", "a/b"];

    for (const habitoId of idsInvalidos) {
      const respuesta = await ejecutar({ habitoId });

      await esperar400(respuesta);
    }
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

  it("devuelve 404 si el hábito no existe", async () => {
    mocks.txGet.mockImplementationOnce(async () => ({
      exists: false,
      data: () => undefined,
    }));

    const respuesta = await ejecutar();

    await esperar404(respuesta);
  });

  it("devuelve 404 si el hábito está borrado lógicamente", async () => {
    mocks.txGet.mockImplementationOnce(async () => ({
      exists: true,
      data: () => ({ ...HABITO_FIRESTORE, deleted_at: FECHA_CREADO }),
    }));

    const respuesta = await ejecutar();

    await esperar404(respuesta);
  });

  it("devuelve 404 si el registro nunca existió", async () => {
    mocks.txGet
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => HABITO_FIRESTORE,
      }))
      .mockImplementationOnce(async () => ({
        exists: false,
        data: () => undefined,
      }));

    const respuesta = await ejecutar();

    await esperar404(respuesta, "Registro no encontrado");
  });

  it("devuelve 200 con el registro borrado lógicamente", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual(DOC_BORRADO);
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.docGet).toHaveBeenCalledTimes(1);
  });

  it("actualiza únicamente deleted_at y updated_at", async () => {
    await ejecutar();

    const llamada = mocks.txUpdate.mock.calls[0];
    const datos = (llamada?.[1] ?? {}) as Record<string, unknown>;

    expect(mocks.txUpdate).toHaveBeenCalledTimes(1);
    expect(datos).toEqual({
      deleted_at: expect.anything(),
      updated_at: expect.anything(),
    });
  });

  it("devuelve 200 y conserva cantidad y created_at", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({
      id: `${ID_HABITO}_${FECHA}`,
      habito_id: ID_HABITO,
      fecha: FECHA,
      cantidad: CANTIDAD,
      created_at: ISO_CREADO,
    });
  });

  it("devuelve 200 si el registro ya estaba borrado", async () => {
    mocks.txGet
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => HABITO_FIRESTORE,
      }))
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => ({
          ...REGISTRO_FIRESTORE,
          updated_at: FECHA_ELIMINADO,
          deleted_at: FECHA_ELIMINADO,
        }),
      }));

    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(200);
    expect(mocks.txUpdate).toHaveBeenCalledTimes(1);
  });

  it("serializa los Timestamp del documento a ISO 8601", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo.created_at).toBe(ISO_CREADO);
    expect(cuerpo.updated_at).toBe(ISO_ACTUALIZADO);
    expect(cuerpo.deleted_at).toBe(ISO_ACTUALIZADO);
    expect(JSON.stringify(cuerpo)).not.toContain("_seconds");
  });

  it("devuelve 500 genérico si falla la transacción", async () => {
    mocks.runTransaction.mockRejectedValueOnce(new Error("transacción caída"));
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("transacción caída");
  });

  it("devuelve 500 genérico si falla la lectura final", async () => {
    mocks.docGet.mockRejectedValueOnce(new Error("lectura final caída"));
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo).toEqual({
      error: "Error interno del servidor",
      detalles: [],
    });
    expect(JSON.stringify(cuerpo)).not.toContain("lectura final caída");
  });

  it("no consulta Firestore si falla la autenticación o validación", async () => {
    const sinToken = await ejecutar({ authorization: null });
    const idInvalido = await ejecutar({ habitoId: "" });
    const fechaInvalida = await ejecutar({ fecha: "2026-02-30" });

    expect(sinToken.status).toBe(401);
    expect(idInvalido.status).toBe(400);
    expect(fechaInvalida.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.txUpdate).not.toHaveBeenCalled();
    expect(mocks.docGet).not.toHaveBeenCalled();
  });

  it("usa el uid del token en la ruta de Firestore", async () => {
    const respuesta = await ejecutar();

    expect(respuesta.status).toBe(200);
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.collection).toHaveBeenCalledWith("habito");
    expect(mocks.docHabito).toHaveBeenCalledWith(ID_HABITO);
    expect(mocks.collection).toHaveBeenCalledWith("registro_habito");
    expect(mocks.docRegistro).toHaveBeenCalledWith(`${ID_HABITO}_${FECHA}`);
  });

  it("exporta DELETE y no exporta runtime", async () => {
    const modulo = await importarModulo();

    expect(modulo).toHaveProperty("DELETE");
    expect("runtime" in modulo).toBe(false);
  });
});
