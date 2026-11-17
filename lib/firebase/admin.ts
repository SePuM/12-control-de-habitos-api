import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

function obtenerVariable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }

  return valor;
}

function crearApp(): App {
  const projectId = obtenerVariable("FIREBASE_PROJECT_ID");
  const clientEmail = obtenerVariable("FIREBASE_CLIENT_EMAIL");
  const privateKey = obtenerVariable("FIREBASE_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function obtenerApp(): App {
  if (app) {
    return app;
  }

  const [appExistente] = getApps();
  app = appExistente ?? crearApp();

  return app;
}

export function getAdminAuth(): Auth {
  return getAuth(obtenerApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(obtenerApp());
}
