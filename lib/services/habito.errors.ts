export type CodigoErrorHabito = "INTERNO" | "NO_ENCONTRADO";

export class HabitoError extends Error {
  constructor(
    readonly codigo: CodigoErrorHabito,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "HabitoError";
  }
}
