import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const URL_REFRESH = "http://localhost:3000/api/auth/refresh";
const CABECERAS_JSON = { "content-type": "application/json" };
const REFRESH_VALIDO = {
  refreshToken: "refresh-token-123",
};
const CLAVE_WEB_ORIGINAL = process.env.FIREBASE_WEB_API_KEY;

type Handler = (request: Request) => Promise<Response>;

async function importarModulo() {
  return import("@/app/api/auth/refresh/route");
}

async function obtenerHandler(): Promise<Handler> {
  const modulo = await importarModulo();
  return modulo.POST;
}

function crearRequest(cuerpo: string | Record<string, unknown>): Request {
  return new Request(URL_REFRESH, {
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

function respuestaRefreshOk(): Response {
  return new Response(
    JSON.stringify({
      id_token: "nuevo-id-token",
      refresh_token: "nuevo-refresh-token",
      expires_in: "3600",
      token_type: "Bearer",
      user_id: "uid-123",
      project_id: "proyecto-falso",
    }),
    {
      status: 200,
      headers: CABECERAS_JSON,
    },
  );
}

function respuestaError(status: number, mensaje: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: status,
        message: mensaje,
        status: "INVALID_ARGUMENT",
      },
    }),
    {
      status,
      headers: CABECERAS_JSON,
    },
  );
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    process.env.FIREBASE_WEB_API_KEY = "test-web-api-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaRefreshOk()));
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

  it("devuelve 400 si falta refreshToken", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest({}));

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si refreshToken está vacío", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest({ refreshToken: "" }));

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si refreshToken no es string", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest({ refreshToken: 12345 }));

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 400 si se envían campos extra", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(
      crearRequest({ ...REFRESH_VALIDO, usuario: "uid-123" }),
    );

    expect(respuesta.status).toBe(400);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 200 con el contrato exacto de tokens renovados", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({
      token: "nuevo-id-token",
      refreshToken: "nuevo-refresh-token",
      expiraEnSeg: 3600,
    });
  });

  it("convierte expires_in de string a número en expiraEnSeg", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(200);
    expect(cuerpo.expiraEnSeg).toBe(3600);
    expect(typeof cuerpo.expiraEnSeg).toBe("number");
  });

  it("envía grant_type y refresh_token correctamente a Secure Token", async () => {
    const POST = await obtenerHandler();
    await POST(crearRequest(REFRESH_VALIDO));

    const llamadasFetch = fetchMock().mock.calls;
    expect(llamadasFetch).toHaveLength(1);
    const [url, opciones] = llamadasFetch[0] ?? [];
    const parametros = new URLSearchParams(String(opciones?.body));
    const cabeceras = new Headers(opciones?.headers);

    expect(String(url)).toContain("securetoken.googleapis.com/v1/token");
    expect(String(url)).toContain("key=test-web-api-key");
    expect(opciones?.method).toBe("POST");
    expect(cabeceras.get("content-type")).toContain(
      "application/x-www-form-urlencoded",
    );
    expect(parametros.get("grant_type")).toBe("refresh_token");
    expect(parametros.get("refresh_token")).toBe(REFRESH_VALIDO.refreshToken);
  });

  it("no expone los nombres originales de Firebase ni datos de usuario", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);
    const serializado = JSON.stringify(cuerpo);

    expect(respuesta.status).toBe(200);
    expect(cuerpo).not.toHaveProperty("id_token");
    expect(cuerpo).not.toHaveProperty("refresh_token");
    expect(cuerpo).not.toHaveProperty("expires_in");
    expect(cuerpo).not.toHaveProperty("user_id");
    expect(cuerpo).not.toHaveProperty("project_id");
    expect(serializado).not.toContain("uid-123");
    expect(serializado).not.toContain("proyecto-falso");
  });

  it("devuelve 401 si Firebase responde INVALID_REFRESH_TOKEN", async () => {
    fetchMock().mockResolvedValueOnce(
      respuestaError(400, "INVALID_REFRESH_TOKEN"),
    );
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "Token de refresco inválido" });
    expect(JSON.stringify(cuerpo)).not.toContain("INVALID_REFRESH_TOKEN");
  });

  it("devuelve 401 si Firebase responde TOKEN_EXPIRED", async () => {
    fetchMock().mockResolvedValueOnce(respuestaError(400, "TOKEN_EXPIRED"));
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(401);
    expect(cuerpo).toEqual({ error: "Token de refresco inválido" });
  });

  it("devuelve 401 si Firebase responde USER_DISABLED o USER_NOT_FOUND", async () => {
    const POST = await obtenerHandler();

    for (const codigo of ["USER_DISABLED", "USER_NOT_FOUND"]) {
      fetchMock().mockResolvedValueOnce(respuestaError(400, codigo));
      const respuesta = await POST(crearRequest(REFRESH_VALIDO));
      expect(respuesta.status).toBe(401);
    }

    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("devuelve el mismo 401 genérico para cualquier rechazo de Firebase", async () => {
    const POST = await obtenerHandler();

    fetchMock().mockResolvedValueOnce(
      respuestaError(400, "INVALID_REFRESH_TOKEN"),
    );
    const respuestaInvalido = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpoInvalido = await leerJson(respuestaInvalido);

    fetchMock().mockResolvedValueOnce(respuestaError(400, "TOKEN_EXPIRED"));
    const respuestaExpirado = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpoExpirado = await leerJson(respuestaExpirado);

    expect(respuestaInvalido.status).toBe(401);
    expect(respuestaExpirado.status).toBe(401);
    expect(cuerpoInvalido).toEqual(cuerpoExpirado);
    expect(cuerpoInvalido).toEqual({
      error: "Token de refresco inválido",
    });
    expect(JSON.stringify(cuerpoInvalido)).not.toContain(
      "INVALID_REFRESH_TOKEN",
    );
    expect(JSON.stringify(cuerpoExpirado)).not.toContain("TOKEN_EXPIRED");
  });

  it("devuelve 500 si falta FIREBASE_WEB_API_KEY y no llama a Secure Token", async () => {
    delete process.env.FIREBASE_WEB_API_KEY;
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));

    expect(respuesta.status).toBe(500);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("devuelve 500 genérico si falla la red", async () => {
    fetchMock().mockRejectedValueOnce(new TypeError("fallo de red"));
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));
    const cuerpo = await leerJson(respuesta);

    expect(respuesta.status).toBe(500);
    expect(cuerpo.error).toBeDefined();
    expect(JSON.stringify(cuerpo)).not.toContain("fallo de red");
  });

  it("devuelve 500 genérico si Firebase responde 200 con un body incompleto", async () => {
    const POST = await obtenerHandler();
    const respuestasIncompletas = [
      { refresh_token: "nuevo-refresh-token", expires_in: "3600" },
      { id_token: "nuevo-id-token", expires_in: "3600" },
      { id_token: "nuevo-id-token", refresh_token: "nuevo-refresh-token" },
    ];

    for (const cuerpoIncompleto of respuestasIncompletas) {
      fetchMock().mockResolvedValueOnce(
        new Response(JSON.stringify(cuerpoIncompleto), {
          status: 200,
          headers: CABECERAS_JSON,
        }),
      );
      const respuesta = await POST(crearRequest(REFRESH_VALIDO));
      const cuerpo = await leerJson(respuesta);

      expect(respuesta.status).toBe(500);
      expect(cuerpo.error).toBeDefined();
      expect(JSON.stringify(cuerpo)).not.toContain("nuevo-id-token");
    }
  });

  it("devuelve 200 como JSON con Cache-Control no-store", async () => {
    const POST = await obtenerHandler();
    const respuesta = await POST(crearRequest(REFRESH_VALIDO));

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toContain("application/json");
    expect(respuesta.headers.get("cache-control")).toBe("no-store");
  });
});
