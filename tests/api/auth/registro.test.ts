import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const createUser = vi.fn();
  const deleteUser = vi.fn();
  const set = vi.fn();
  const deleteDoc = vi.fn();
  const doc = vi.fn(() => ({ set, delete: deleteDoc }));
  const collection = vi.fn(() => ({ doc }));
  const getFirestore = vi.fn(() => ({ collection }));

  return {
    createUser,
    deleteUser,
    set,
    deleteDoc,
    doc,
    collection,
    getFirestore,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    createUser: mocks.createUser,
    deleteUser: mocks.deleteUser,
  }),
  getAdminFirestore: mocks.getFirestore,
}));

const URL_REGISTRO = "http://localhost:3000/api/auth/registro";
const CABECERAS_JSON = { "content-type": "application/json" };
const USUARIO_CREADO = {
  uid: "uid-123",
  email: "ana@example.com",
  displayName: "Ana",
};
const REGISTRO_VALIDO = {
  nombre: "Ana",
  email: " Ana@Example.com ",
  password: "secreto123",
};
const CLAVE_WEB_ORIGINAL = process.env.FIREBASE_WEB_API_KEY;

type Handler = (request: Request) => Promise<Response>;

async function importarModulo() {
  return import("@/app/api/auth/registro/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.POST;
}

function crearRequest(cuerpo: string | Record<string, unknown>): Request {
  return new Request(URL_REGISTRO, {
    method: "POST",
    headers: CABECERAS_JSON,
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  return (await respuesta.json()) as Record<string, unknown>;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function respuestaSignInOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ idToken: "token-secreto" }),
  };
}

function respuestaSignInFallida() {
  return {
    ok: false,
    status: 400,
    json: async () => ({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }),
  };
}

function errorFirebase(codigo: string): Error & { code: string } {
  return Object.assign(new Error(`Error de Firebase: ${codigo}`), {
    code: codigo,
  });
}

describe("POST /api/auth/registro", () => {
  beforeEach(() => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
    mocks.createUser.mockResolvedValue(USUARIO_CREADO);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.set.mockResolvedValue(undefined);
    mocks.deleteDoc.mockResolvedValue(undefined);
    mocks.doc.mockReturnValue({ set: mocks.set, delete: mocks.deleteDoc });
    mocks.collection.mockReturnValue({ doc: mocks.doc });
    mocks.getFirestore.mockReturnValue({ collection: mocks.collection });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaSignInOk()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    if (CLAVE_WEB_ORIGINAL === undefined) {
      delete process.env.FIREBASE_WEB_API_KEY;
    } else {
      process.env.FIREBASE_WEB_API_KEY = CLAVE_WEB_ORIGINAL;
    }
  });

  it("devuelve 400 si el body no es JSON válido", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest("{ esto no es json"));

    expect(respuesta.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el nombre falta, está vacío o excede 80 caracteres", async () => {
    const POST = await obtenerHandler();
    const cuerpos = [
      { email: "ana@example.com", password: "secreto123" },
      { nombre: "   ", email: "ana@example.com", password: "secreto123" },
      {
        nombre: "a".repeat(81),
        email: "ana@example.com",
        password: "secreto123",
      },
    ];

    for (const cuerpo of cuerpos) {
      const respuesta = await POST(crearRequest(cuerpo));
      expect(respuesta.status).toBe(400);
    }

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el email es inválido", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...REGISTRO_VALIDO, email: "no-es-email" }),
    );

    expect(respuesta.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si la contraseña tiene menos de 8 caracteres", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...REGISTRO_VALIDO, password: "corta" }),
    );

    expect(respuesta.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si se envían campos extra", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...REGISTRO_VALIDO, admin: true }),
    );

    expect(respuesta.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 201 con el usuario público y persiste Auth y Firestore", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(201);
    expect(cuerpo).toEqual({
      uid: "uid-123",
      email: "ana@example.com",
      nombre: "Ana",
    });
    expect(cuerpo).not.toHaveProperty("password");
    expect(cuerpo).not.toHaveProperty("idToken");

    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "secreto123",
      displayName: "Ana",
    });

    const llamadasFetch = fetchMock().mock.calls;
    expect(llamadasFetch).toHaveLength(1);
    const [url, opciones] = llamadasFetch[0] ?? [];
    expect(String(url)).toContain("accounts:signInWithPassword");
    expect(String(url)).toContain("key=test-web-api-key");
    expect(JSON.parse(String(opciones?.body))).toEqual({
      email: "ana@example.com",
      password: "secreto123",
      returnSecureToken: true,
    });

    expect(mocks.collection).toHaveBeenCalledWith("usuarios");
    expect(mocks.doc).toHaveBeenCalledWith("uid-123");
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "Ana",
        email: "ana@example.com",
        creadoEn: expect.anything(),
      }),
    );
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(JSON.stringify(cuerpo)).not.toContain("token-secreto");
    expect(JSON.stringify(cuerpo)).not.toContain("secreto123");
  });

  it("devuelve 409 si el correo ya está registrado", async () => {
    mocks.createUser.mockRejectedValueOnce(
      errorFirebase("auth/email-already-exists"),
    );
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(409);
    expect(cuerpo.error).toBeDefined();
    expect(JSON.stringify(cuerpo)).not.toContain("auth/email-already-exists");
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("devuelve 400 si Firebase rechaza la contraseña", async () => {
    const POST = await obtenerHandler();

    for (const codigo of ["auth/invalid-password", "auth/weak-password"]) {
      mocks.createUser.mockRejectedValueOnce(errorFirebase(codigo));
      const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
      expect(respuesta.status).toBe(400);
    }

    expect(mocks.createUser).toHaveBeenCalledTimes(2);
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("devuelve 401 si las credenciales fallan al iniciar sesión y revierte el usuario", async () => {
    fetchMock().mockResolvedValueOnce(respuestaSignInFallida());
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo.error).toBeDefined();
    expect(JSON.stringify(cuerpo)).not.toContain("INVALID_LOGIN_CREDENTIALS");
    expect(mocks.deleteUser).toHaveBeenCalledWith("uid-123");
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it("devuelve 500 y revierte el usuario si falla Firestore", async () => {
    mocks.set.mockRejectedValueOnce(new Error("firestore caído"));
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo.error).toBeDefined();
    expect(JSON.stringify(cuerpo)).not.toContain("firestore caído");
    expect(mocks.deleteUser).toHaveBeenCalledWith("uid-123");
  });

  it("devuelve 500 genérico si Firebase Admin falla de forma inesperada", async () => {
    mocks.createUser.mockRejectedValueOnce(new Error("detalle interno"));
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo.error).toBeDefined();
    expect(JSON.stringify(cuerpo)).not.toContain("detalle interno");
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("devuelve 500 si falta FIREBASE_WEB_API_KEY y no crea el usuario", async () => {
    delete process.env.FIREBASE_WEB_API_KEY;
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REGISTRO_VALIDO));

    expect(respuesta.status).toBe(500);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("exporta runtime nodejs", async () => {
    const modulo = await importarModulo();
    expect(modulo.runtime).toBe("nodejs");
  });
});
