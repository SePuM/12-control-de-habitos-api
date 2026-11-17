import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { HabitoInput } from "@/lib/schemas/habito";
import { HabitoError } from "@/lib/services/habito.errors";

export interface HabitoDocumento {
  id: string;
  nombre: string;
  tipo: HabitoInput["tipo"];
  meta: number;
  activo: boolean;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

type DatosHabito = Record<string, unknown>;

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

function construirDocumento(id: string, datos: DatosHabito): HabitoDocumento {
  const { nombre, tipo, meta, activo } = datos;

  if (
    typeof nombre !== "string" ||
    (tipo !== "manual" && tipo !== "pasos") ||
    typeof meta !== "number" ||
    !Number.isInteger(meta) ||
    typeof activo !== "boolean"
  ) {
    throw new HabitoError("INTERNO", "Documento de hábito inválido");
  }

  return {
    id,
    nombre,
    tipo,
    meta,
    activo,
    created_at: serializarFecha(datos.created_at),
    updated_at: serializarFecha(datos.updated_at),
    deleted_at: serializarFecha(datos.deleted_at),
  };
}

export async function listarHabitos(
  uid: string,
  since?: Date,
): Promise<HabitoDocumento[]> {
  try {
    const firestore = getAdminFirestore();
    const coleccion = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("habito");
    const consulta = since
      ? coleccion.where("updated_at", ">=", Timestamp.fromDate(since))
      : coleccion;
    const resultado = await consulta.get();

    return resultado.docs.map((documento) =>
      construirDocumento(documento.id, documento.data() as DatosHabito),
    );
  } catch (error) {
    if (error instanceof HabitoError) {
      throw error;
    }

    throw new HabitoError("INTERNO", "No se pudieron consultar los hábitos");
  }
}

export async function eliminarHabito(
  uid: string,
  id: string,
): Promise<HabitoDocumento> {
  try {
    const firestore = getAdminFirestore();
    const referencia = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("habito")
      .doc(id);

    await firestore.runTransaction(async (transaccion) => {
      const actual = await transaccion.get(referencia);

      if (!actual.exists) {
        throw new HabitoError("NO_ENCONTRADO", "Hábito no encontrado");
      }

      await transaccion.update(referencia, {
        deleted_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    const eliminado = await referencia.get();
    const documento = eliminado.data() as DatosHabito | undefined;

    if (!eliminado.exists || !documento) {
      throw new HabitoError("INTERNO", "No se pudo leer el hábito eliminado");
    }

    return construirDocumento(id, documento);
  } catch (error) {
    if (error instanceof HabitoError) {
      throw error;
    }

    throw new HabitoError("INTERNO", "No se pudo eliminar el hábito");
  }
}

export async function guardarHabito(
  uid: string,
  id: string,
  datos: HabitoInput,
): Promise<HabitoDocumento> {
  try {
    const firestore = getAdminFirestore();
    const referencia = firestore
      .collection("usuarios")
      .doc(uid)
      .collection("habito")
      .doc(id);

    await firestore.runTransaction(async (transaccion) => {
      const actual = await transaccion.get(referencia);
      const existente = actual.data() as DatosHabito | undefined;

      await transaccion.set(referencia, {
        ...datos,
        created_at: existente?.created_at ?? FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        deleted_at: null,
      });
    });

    const escrito = await referencia.get();
    const documento = escrito.data() as DatosHabito | undefined;

    if (!escrito.exists || !documento) {
      throw new HabitoError("INTERNO", "No se pudo leer el hábito guardado");
    }

    return construirDocumento(id, documento);
  } catch (error) {
    if (error instanceof HabitoError) {
      throw error;
    }

    throw new HabitoError("INTERNO", "No se pudo guardar el hábito");
  }
}
