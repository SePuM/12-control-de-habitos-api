import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const URL_LOGIN = "http://localhost:3000/api/auth/login";
const CABECERAS_JSON = { "content-type": "application/json" };
const LOGIN_VALIDO = {
  email: " Ana@Example.com ",
  password: "secreto123",
};
const CLAVE_WEB_ORIGINAL = process.env.FIREBASE_WEB_API_KEY;

type Handler = (request: Request) => Promise<Response>;

async function importarModulo() {
  return import("@/app/api/auth/login/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.POST;
}

function crearRequest(cuerpo: string | Record<string, unknown>): Request {
  return new Request(URL_LOGIN, {
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

function respuestaLoginOk(): Response {
  return new Response(
    JSON.stringify({
      idToken: "id-token-123",
      refreshToken: "refresh-token-123",
      expiresIn: "3600",
      localId: "uid-123",
      email: "ana@example.com",
      registered: true,
    }),
    {
      status: 200,
      headers: CABECERAS_JSON,
    },
  );
}

function respuestaError(status: number, mensaje: string): Response {
  return new Response(JSON.stringify({ error: { message: mensaje } }), {
    status,
    headers: CABECERAS_JSON,
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaLoginOk()));
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
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si falta el email", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ password: LOGIN_VALIDO.password }),
    );

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el email es inválido", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...LOGIN_VALIDO, email: "no-es-email" }),
    );

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si falta la contraseña o está vacía", async () => {
    const POST = await obtenerHandler();
    const cuerpos = [
      { email: LOGIN_VALIDO.email },
      { email: LOGIN_VALIDO.email, password: "" },
    ];

    for (const cuerpo of cuerpos) {
      const respuesta = await POST(crearRequest(cuerpo));
      expect(respuesta.status).toBe(400);
    }

    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si se envían campos extra", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...LOGIN_VALIDO, admin: true }),
    );

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 200 con tokens y usuario según el contrato", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({
      token: "id-token-123",
      refreshToken: "refresh-token-123",
      expiraEnSeg: 3600,
      usuario: {
        id: "uid-123",
        email: "ana@example.com",
      },
    });
    expect(cuerpo).not.toHaveProperty("idToken");
    expect(cuerpo).not.toHaveProperty("password");
  });

  it("envía email y contraseña correctamente a Identity Toolkit", async () => {
    const POST = await obtenerHandler();
    await POST(crearRequest(LOGIN_VALIDO));

    const llamadasFetch = fetchMock().mock.calls;
    expect(llamadasFetch).toHaveLength(1);
    const [url, opciones] = llamadasFetch[0] ?? [];

    expect(String(url)).toContain("accounts:signInWithPassword");
    expect(String(url)).toContain("key=test-web-api-key");
    expect(JSON.parse(String(opciones?.body))).toEqual({
      email: "ana@example.com",
      password: LOGIN_VALIDO.password,
      returnSecureToken: true,
    });
  });

  it("devuelve 200 con el email normalizado y sin exponer la contraseña", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...LOGIN_VALIDO, email: " ANA@Example.COM " }),
    );
    const cuerpo = await leerJson(respuesta);
    const usuario = cuerpo.usuario as Record<string, unknown>;

    expect(respuesta.status).toBe(200);
    expect(usuario.email).toBe("ana@example.com");
    expect(JSON.stringify(cuerpo)).not.toContain(LOGIN_VALIDO.password);
  });

  it("devuelve 401 si Firebase responde EMAIL_NOT_FOUND", async () => {
    fetchMock().mockResolvedValueOnce(respuestaError(400, "EMAIL_NOT_FOUND"));
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "Credenciales inválidas" });
    expect(JSON.stringify(cuerpo)).not.toContain("EMAIL_NOT_FOUND");
  });

  it("devuelve 401 si Firebase responde INVALID_PASSWORD o INVALID_LOGIN_CREDENTIALS", async () => {
    const POST = await obtenerHandler();

    for (const codigo of ["INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS"]) {
      fetchMock().mockResolvedValueOnce(respuestaError(400, codigo));
      const respuesta = await POST(crearRequest(LOGIN_VALIDO));
      expect(respuesta.status).toBe(401);
    }

    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("devuelve el mismo 401 genérico exista o no el usuario", async () => {
    const POST = await obtenerHandler();

    fetchMock().mockResolvedValueOnce(respuestaError(400, "EMAIL_NOT_FOUND"));
    const respuestaUsuarioInexistente = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpoUsuarioInexistente = await leerJson(
      respuestaUsuarioInexistente,
    );

    fetchMock().mockResolvedValueOnce(respuestaError(400, "INVALID_PASSWORD"));
    const respuestaPasswordIncorrecta = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpoPasswordIncorrecta = await leerJson(
      respuestaPasswordIncorrecta,
    );

    expect(respuestaUsuarioInexistente.status).toBe(401);
    expect(respuestaPasswordIncorrecta.status).toBe(401);
    expect(cuerpoUsuarioInexistente).toEqual(cuerpoPasswordIncorrecta);
    expect(cuerpoUsuarioInexistente).toEqual({
      error: "Credenciales inválidas",
    });
    expect(JSON.stringify(cuerpoUsuarioInexistente)).not.toContain(
      "EMAIL_NOT_FOUND",
    );
    expect(JSON.stringify(cuerpoPasswordIncorrecta)).not.toContain(
      "INVALID_PASSWORD",
    );
  });

  it("devuelve 429 si Firebase responde HTTP 429 con demasiados intentos", async () => {
    fetchMock().mockResolvedValueOnce(
      respuestaError(429, "TOO_MANY_ATTEMPTS_TRY_LATER"),
    );
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(429);
    expect(cuerpo).toEqual({ error: "Demasiados intentos" });
  });

  it("devuelve 429 si Firebase responde HTTP 400 con TOO_MANY_ATTEMPTS_TRY_LATER", async () => {
    fetchMock().mockResolvedValueOnce(
      respuestaError(400, "TOO_MANY_ATTEMPTS_TRY_LATER"),
    );
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(429);
    expect(cuerpo).toEqual({ error: "Demasiados intentos" });
  });

  it("devuelve 500 si falta FIREBASE_WEB_API_KEY y no llama a Identity Toolkit", async () => {
    delete process.env.FIREBASE_WEB_API_KEY;
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(LOGIN_VALIDO));

    expect(respuesta.status).toBe(500);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 500 genérico si falla la red o la respuesta exitosa está malformada", async () => {
    const POST = await obtenerHandler();

    fetchMock().mockRejectedValueOnce(new TypeError("fallo de red"));
    const respuestaRed = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpoRed = await leerJson(respuestaRed);

    fetchMock().mockResolvedValueOnce(
      new Response(JSON.stringify({ idToken: "solo-token" }), {
        status: 200,
        headers: CABECERAS_JSON,
      }),
    );
    const respuestaMalformada = await POST(crearRequest(LOGIN_VALIDO));
    const cuerpoMalformado = await leerJson(respuestaMalformada);

    expect(respuestaRed.status).toBe(500);
    expect(respuestaMalformada.status).toBe(500);
    expect(cuerpoRed.error).toBeDefined();
    expect(cuerpoMalformado.error).toBeDefined();
    expect(JSON.stringify(cuerpoRed)).not.toContain("fallo de red");
    expect(JSON.stringify(cuerpoMalformado)).not.toContain("solo-token");
  });
});
