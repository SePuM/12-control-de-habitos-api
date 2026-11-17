export type CodigoErrorLogin =
  | "CREDENCIALES_INVALIDAS"
  | "DEMASIADOS_INTENTOS"
  | "CONFIGURACION"
  | "INTERNO";

export class LoginError extends Error {
  constructor(
    readonly codigo: CodigoErrorLogin,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "LoginError";
  }
}
