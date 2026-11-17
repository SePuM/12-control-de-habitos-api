export type CodigoErrorRefresh =
  "REFRESH_TOKEN_INVALIDO" | "CONFIGURACION" | "INTERNO";

export class RefreshError extends Error {
  constructor(
    readonly codigo: CodigoErrorRefresh,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "RefreshError";
  }
}
