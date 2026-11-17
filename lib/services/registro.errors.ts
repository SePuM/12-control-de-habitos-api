export type CodigoErrorRegistro =
  | "EMAIL_EN_USO"
  | "PASSWORD_INVALIDA"
  | "CREDENCIALES_INVALIDAS"
  | "CONFIGURACION"
  | "INTERNO";

export class RegistroError extends Error {
  constructor(
    readonly codigo: CodigoErrorRegistro,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "RegistroError";
  }
}
