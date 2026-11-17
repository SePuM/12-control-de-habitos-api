import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { verificarCredenciales } from "@/lib/firebase/identity-toolkit";
import type { RegistroInput } from "@/lib/schemas/registro";
import { RegistroError } from "@/lib/services/registro.errors";

export interface UsuarioPublico {
  uid: string;
  email: string;
  nombre: string;
}

const CODIGOS_PASSWORD_INVALIDA = new Set([
  "auth/invalid-password",
  "auth/weak-password",
]);

function esErrorConCodigo(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

function mapearErrorCreacion(error: unknown): RegistroError {
  if (esErrorConCodigo(error)) {
    if (error.code === "auth/email-already-exists") {
      return new RegistroError("EMAIL_EN_USO", "El correo ya está registrado");
    }

    if (CODIGOS_PASSWORD_INVALIDA.has(error.code)) {
      return new RegistroError(
        "PASSWORD_INVALIDA",
        "La contraseña no es válida",
      );
    }
  }

  return new RegistroError("INTERNO", "No se pudo crear el usuario");
}

async function crearUsuario(datos: RegistroInput): Promise<UserRecord> {
  try {
    return await getAdminAuth().createUser({
      email: datos.email,
      password: datos.password,
      displayName: datos.nombre,
    });
  } catch (error) {
    throw mapearErrorCreacion(error);
  }
}

async function crearPerfil(uid: string, datos: RegistroInput): Promise<void> {
  await getAdminFirestore().collection("usuarios").doc(uid).set({
    nombre: datos.nombre,
    email: datos.email,
    creadoEn: FieldValue.serverTimestamp(),
  });
}

async function revertirUsuario(uid: string): Promise<void> {
  await getAdminAuth()
    .deleteUser(uid)
    .catch(() => undefined);
}

export async function registrarUsuario(
  datos: RegistroInput,
): Promise<UsuarioPublico> {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey) {
    throw new RegistroError(
      "CONFIGURACION",
      "Falta la configuración de Firebase",
    );
  }

  const usuarioCreado = await crearUsuario(datos);

  try {
    await verificarCredenciales(datos.email, datos.password, apiKey);
  } catch {
    await revertirUsuario(usuarioCreado.uid);
    throw new RegistroError(
      "CREDENCIALES_INVALIDAS",
      "No se pudieron validar las credenciales",
    );
  }

  try {
    await crearPerfil(usuarioCreado.uid, datos);
  } catch {
    await revertirUsuario(usuarioCreado.uid);
    throw new RegistroError("INTERNO", "No se pudo completar el registro");
  }

  return {
    uid: usuarioCreado.uid,
    email: datos.email,
    nombre: datos.nombre,
  };
}
