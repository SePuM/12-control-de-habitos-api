export type CodigoErrorRegistroHabito =
  "INTERNO" | "HABITO_NO_ENCONTRADO" | "REGISTRO_NO_ENCONTRADO";

export class RegistroHabitoError extends Error {
  constructor(
    readonly codigo: CodigoErrorRegistroHabito,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "RegistroHabitoError";
  }
}
