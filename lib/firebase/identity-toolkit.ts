const URL_SIGN_IN =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

export async function verificarCredenciales(
  email: string,
  password: string,
  apiKey: string,
): Promise<void> {
  const respuesta = await fetch(
    `${URL_SIGN_IN}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  if (!respuesta.ok) {
    throw new Error("No se pudieron verificar las credenciales");
  }
}
