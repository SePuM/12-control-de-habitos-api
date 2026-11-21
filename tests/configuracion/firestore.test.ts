import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();

describe("configuración base de Firestore", () => {
  it("niega lectura y escritura a clientes en firestore.rules", () => {
    const reglas = readFileSync(join(raiz, "firestore.rules"), "utf8");

    expect(reglas).toContain("rules_version = '2';");
    expect(reglas).toContain("allow read, write: if false;");
  });

  it("declara índices para updated_at y fecha", () => {
    const indices = JSON.parse(
      readFileSync(join(raiz, "firestore.indexes.json"), "utf8"),
    ) as {
      indexes: Array<{
        collectionGroup: string;
        fields: Array<{ fieldPath: string }>;
      }>;
    };

    expect(indices.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionGroup: "habito",
          fields: expect.arrayContaining([
            expect.objectContaining({ fieldPath: "updated_at" }),
          ]),
        }),
        expect.objectContaining({
          collectionGroup: "registro_habito",
          fields: expect.arrayContaining([
            expect.objectContaining({ fieldPath: "fecha" }),
          ]),
        }),
      ]),
    );
  });
});
