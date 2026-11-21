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
    txSet,
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
  deleted_at: null,
};
const DOC_REGISTRO = {
  id: `${ID_HABITO}_${FECHA}`,
  habito_id: ID_HABITO,
  fecha: FECHA,
  cantidad: CANTIDAD,
  created_at: ISO_CREADO,
  updated_at: ISO_ACTUALIZADO,
  deleted_at: null,
};

type Handler = (
  request: Request,
  context: { params: Promise<{ habitoId: string; fecha: string }> },
) => Promise<Response>;

type OpcionesRequest = {
  body?: string | Record<string, unknown>;
  habitoId?: string;
  fecha?: string;
  authorization?: string | null;
};

async function importarModulo() {
  return import("@/app/api/registro_habito/[habitoId]/[fecha]/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.PUT;
}

async function ejecutar(opciones: OpcionesRequest = {}): Promise<Response> {
  const {
    body = { cantidad: CANTIDAD },
    habitoId = ID_HABITO,
    fecha = FECHA,
    authorization = `Bearer ${TOKEN_VALIDO}`,
  } = opciones;
  const handler = await obtenerHandler();
  const headers = new Headers({ "content-type": "application/json" });

  if (authorization !== null) {
    headers.set("authorization", authorization);
  }

  const request = new Request(
    `http://localhost:3000/api/registro_habito/${encodeURIComponent(habitoId)}/${encodeURIComponent(fecha)}`,
    {
      method: "PUT",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );

  return handler(request, {
    params: Promise.resolve({ habitoId, fecha }),
  });
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

async function esperar401(respuesta: Response): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(401);
  expect(cuerpo).toEqual({ error: "No autorizado", detalles: [] });
  expect(mocks.runTransaction).not.toHaveBeenCalled();
  expect(mocks.txSet).not.toHaveBeenCalled();
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
  expect(mocks.txSet).not.toHaveBeenCalled();
}

async function esperar404(
  respuesta: Response,
  mensaje = "Hábito no encontrado",
): Promise<void> {
  const cuerpo = await leerJson(respuesta);

  expect(respuesta.status).toBe(404);
  expect(cuerpo).toEqual({ error: mensaje, detalles: [] });
  expect(mocks.txSet).not.toHaveBeenCalled();
  expect(mocks.docGet).not.toHaveBeenCalled();
}

function datosEscritos(): Record<string, unknown> {
  const llamada = mocks.txSet.mock.calls[0];

  return (llamada?.[1] ?? {}) as Record<string, unknown>;
}

describe("PUT /api/registro_habito/[habitoId]/[fecha]", () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockResolvedValue({ uid: UID_TOKEN });
    mocks.txGet.mockImplementation(
      async (referencia: { tipo?: string } | undefined) => {
        if (referencia?.tipo === "habito") {
          return { exists: true, data: () => HABITO_FIRESTORE };
        }

        return { exists: false, data: () => undefined };
      },
    );
    mocks.txSet.mockResolvedValue(undefined);
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => REGISTRO_FIRESTORE,
    });
    mocks.runTransaction.mockImplementation(async (callback) =>
      callback({ get: mocks.txGet, set: mocks.txSet }),
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

  it("devuelve 400 si el body no es JSON válido", async () => {
    const respuesta = await ejecutar({ body: "{ esto no es json" });

    await esperar400(respuesta);
  });

  it("devuelve 400 si falta cantidad", async () => {
    const respuesta = await ejecutar({ body: {} });

    await esperar400(respuesta);
  });

  it("devuelve 400 si cantidad no es un entero mayor o igual a 0", async () => {
    const cantidadesInvalidas = [-1, 1.5, "10", null];

    for (const cantidad of cantidadesInvalidas) {
      const respuesta = await ejecutar({ body: { cantidad } });

      await esperar400(respuesta);
    }
  });

  it("devuelve 400 si se envían campos extra", async () => {
    const cuerposInvalidos = [
      { cantidad: CANTIDAD, uid: "uid-atacante" },
      { cantidad: CANTIDAD, habito_id: ID_HABITO },
      { cantidad: CANTIDAD, fecha: FECHA },
    ];

    for (const body of cuerposInvalidos) {
      const respuesta = await ejecutar({ body });

      await esperar400(respuesta);
    }
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

  it("devuelve 200 y crea el registro usando el uid del token", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual(DOC_REGISTRO);
    expect(mocks.verifyIdToken).toHaveBeenCalledWith(TOKEN_VALIDO);
    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.docUsuario).toHaveBeenCalledWith(UID_TOKEN);
    expect(mocks.collection).toHaveBeenCalledWith("habito");
    expect(mocks.docHabito).toHaveBeenCalledWith(ID_HABITO);
    expect(mocks.collection).toHaveBeenCalledWith("registro_habito");
    expect(mocks.docRegistro).toHaveBeenCalledWith(`${ID_HABITO}_${FECHA}`);
    expect(datosEscritos()).toMatchObject({
      habito_id: ID_HABITO,
      fecha: FECHA,
      cantidad: CANTIDAD,
      deleted_at: null,
    });
    expect(datosEscritos().created_at).toBeDefined();
    expect(datosEscritos().updated_at).toBeDefined();
    expect(mocks.docGet).toHaveBeenCalledTimes(1);
  });

  it("devuelve 200 y conserva created_at al actualizar", async () => {
    mocks.txGet
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => HABITO_FIRESTORE,
      }))
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => ({
          created_at: FECHA_CREADO,
          deleted_at: FECHA_ACTUALIZADO,
        }),
      }));
    mocks.docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ ...REGISTRO_FIRESTORE, cantidad: 25 }),
    });

    const respuesta = await ejecutar({ body: { cantidad: 25 } });
    const cuerpo = await leerJson(respuesta);
    const datos = datosEscritos();

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({ ...DOC_REGISTRO, cantidad: 25 });
    expect(datos.created_at).toBe(FECHA_CREADO);
    expect(datos.updated_at).toBeDefined();
    expect(datos.deleted_at).toBeNull();
  });

  it("devuelve 200 y revive un registro borrado lógicamente", async () => {
    mocks.txGet
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => HABITO_FIRESTORE,
      }))
      .mockImplementationOnce(async () => ({
        exists: true,
        data: () => ({
          created_at: FECHA_CREADO,
          deleted_at: FECHA_ACTUALIZADO,
        }),
      }));

    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual(DOC_REGISTRO);
    expect(datosEscritos().deleted_at).toBeNull();
  });

  it("devuelve 200 de forma idempotente al repetir el mismo PUT", async () => {
    mocks.txGet.mockImplementation(async (referencia: { tipo?: string }) => {
      if (referencia?.tipo === "habito") {
        return { exists: true, data: () => HABITO_FIRESTORE };
      }

      return {
        exists: true,
        data: () => ({ created_at: FECHA_CREADO, deleted_at: null }),
      };
    });

    const primera = await ejecutar();
    const segunda = await ejecutar();

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.txSet).toHaveBeenCalledTimes(2);
    expect(mocks.docRegistro).toHaveBeenNthCalledWith(
      1,
      `${ID_HABITO}_${FECHA}`,
    );
    expect(mocks.docRegistro).toHaveBeenNthCalledWith(
      2,
      `${ID_HABITO}_${FECHA}`,
    );

    for (const llamada of mocks.txSet.mock.calls) {
      const datos = (llamada[1] ?? {}) as Record<string, unknown>;

      expect(datos.created_at).toBe(FECHA_CREADO);
    }
  });

  it("serializa los Timestamp del documento a ISO 8601", async () => {
    const respuesta = await ejecutar();
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo.created_at).toBe(ISO_CREADO);
    expect(cuerpo.updated_at).toBe(ISO_ACTUALIZADO);
    expect(cuerpo.deleted_at).toBeNull();
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

  it("no escribe en Firestore si falla la autenticación o validación", async () => {
    const sinToken = await ejecutar({ authorization: null });
    const bodyInvalido = await ejecutar({ body: { cantidad: -1 } });
    const fechaInvalida = await ejecutar({ fecha: "2026-02-30" });

    expect(sinToken.status).toBe(401);
    expect(bodyInvalido.status).toBe(400);
    expect(fechaInvalida.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it("exporta PUT y no exporta runtime", async () => {
    const modulo = await importarModulo();

    expect(modulo).toHaveProperty("PUT");
    expect("runtime" in modulo).toBe(false);
  });
});
