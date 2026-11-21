import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { RegistroHabitoInput } from "@/lib/schemas/registro-habito";
import { RegistroHabitoError } from "@/lib/services/registro-habito.errors";

export interface RegistroHabitoDocumento {
  id: string;
  habito_id: string;
  fecha: string;
  cantidad: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

type DatosRegistro = Record<string, unknown>;

function serializarFecha(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (valor instanceof Timestamp) {
    return valor.toDate().toISOString();
  }

  if (typeof valor === "string") {
    return valor;
  }

  return null;
}

function construirDocumento(
  id: string,
  datos: DatosRegistro,
): RegistroHabitoDocumento {
  const { habito_id, fecha, cantidad } = datos;

  if (
    typeof habito_id !== "string" ||
    typeof fecha !== "string" ||
    typeof cantidad !== "number" ||
    !Number.isInteger(cantidad) ||
    cantidad < 0
  ) {
    throw new RegistroHabitoError("INTERNO", "Documento de registro inválido");
  }

  return {
    id,
    habito_id,
    fecha,
    cantidad,
    created_at: serializarFecha(datos.created_at),
    updated_at: serializarFecha(datos.updated_at),
    deleted_at: serializarFecha(datos.deleted_at),
  };
}

export async function guardarRegistroHabito(
  uid: string,
  habitoId: string,
  fecha: string,
  datos: RegistroHabitoInput,
): Promise<RegistroHabitoDocumento> {
  try {
    const firestore = getAdminFirestore();
    const referenciaHabito = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("habito")
      .doc(habitoId);
    const idRegistro = `${habitoId}_${fecha}`;
    const referenciaRegistro = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("registro_habito")
      .doc(idRegistro);

    await firestore.runTransaction(async (transaccion) => {
      const habito = await transaccion.get(referenciaHabito);

      if (!habito.exists || habito.data()?.deleted_at != null) {
        throw new RegistroHabitoError(
          "HABITO_NO_ENCONTRADO",
          "Hábito no encontrado",
        );
      }

      const actual = await transaccion.get(referenciaRegistro);
      const existente = actual.data() as DatosRegistro | undefined;

      await transaccion.set(referenciaRegistro, {
        habito_id: habitoId,
        fecha,
        cantidad: datos.cantidad,
        created_at: existente?.created_at ?? FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        deleted_at: null,
      });
    });

    const escrito = await referenciaRegistro.get();
    const documento = escrito.data() as DatosRegistro | undefined;

    if (!escrito.exists || !documento) {
      throw new RegistroHabitoError(
        "INTERNO",
        "No se pudo leer el registro guardado",
      );
    }

    return construirDocumento(idRegistro, documento);
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      throw error;
    }

    throw new RegistroHabitoError("INTERNO", "No se pudo guardar el registro");
  }
}

export async function eliminarRegistroHabito(
  uid: string,
  habitoId: string,
  fecha: string,
): Promise<RegistroHabitoDocumento> {
  try {
    const firestore = getAdminFirestore();
    const referenciaHabito = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("habito")
      .doc(habitoId);
    const idRegistro = `${habitoId}_${fecha}`;
    const referenciaRegistro = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("registro_habito")
      .doc(idRegistro);

    await firestore.runTransaction(async (transaccion) => {
      const habito = await transaccion.get(referenciaHabito);

      if (!habito.exists || habito.data()?.deleted_at != null) {
        throw new RegistroHabitoError(
          "HABITO_NO_ENCONTRADO",
          "Hábito no encontrado",
        );
      }

      const actual = await transaccion.get(referenciaRegistro);

      if (!actual.exists) {
        throw new RegistroHabitoError(
          "REGISTRO_NO_ENCONTRADO",
          "Registro no encontrado",
        );
      }

      await transaccion.update(referenciaRegistro, {
        deleted_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    const eliminado = await referenciaRegistro.get();
    const documento = eliminado.data() as DatosRegistro | undefined;

    if (!eliminado.exists || !documento) {
      throw new RegistroHabitoError(
        "INTERNO",
        "No se pudo leer el registro eliminado",
      );
    }

    return construirDocumento(idRegistro, documento);
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      throw error;
    }

    throw new RegistroHabitoError("INTERNO", "No se pudo eliminar el registro");
  }
}

export async function listarRegistrosPorFecha(
  uid: string,
  fecha: string,
): Promise<RegistroHabitoDocumento[]> {
  try {
    const firestore = getAdminFirestore();
    const resultado = await firestore
      .collection("usuarios")
      .doc(uid)
      .collection("registro_habito")
      .where("fecha", "==", fecha)
      .get();

    return resultado.docs.map((documento) =>
      construirDocumento(documento.id, documento.data() as DatosRegistro),
    );
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      throw error;
    }

    throw new RegistroHabitoError(
      "INTERNO",
      "No se pudieron consultar los registros",
    );
  }
}

export async function listarRegistros(
  uid: string,
): Promise<RegistroHabitoDocumento[]> {
  try {
    const firestore = getAdminFirestore();
    const resultado = await firestore
      .collection("usuarios")
      .doc(uid)
      .collection("registro_habito")
      .get();

    return resultado.docs.map((documento) =>
      construirDocumento(documento.id, documento.data() as DatosRegistro),
    );
  } catch (error) {
    if (error instanceof RegistroHabitoError) {
      throw error;
    }

    throw new RegistroHabitoError(
      "INTERNO",
      "No se pudieron consultar los registros",
    );
  }
}
