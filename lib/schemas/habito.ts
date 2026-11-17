import { z } from "zod";

const META_MINIMA_PASOS = 500;
const META_MAXIMA_PASOS = 50000;

export const habitoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(40),
    tipo: z.enum(["manual", "pasos"]),
    meta: z.number().int().positive(),
    activo: z.boolean(),
  })
  .strict()
  .refine(
    (datos) =>
      datos.tipo !== "pasos" ||
      (datos.meta >= META_MINIMA_PASOS && datos.meta <= META_MAXIMA_PASOS),
    {
      path: ["meta"],
      message: "Para tipo pasos, meta debe estar entre 500 y 50000",
    },
  );

export const habitoIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido");

export const habitoQuerySchema = z.object({
  since: z.iso.datetime({ offset: true }).optional(),
});

export type HabitoInput = z.infer<typeof habitoSchema>;
export type HabitoQuery = z.infer<typeof habitoQuerySchema>;
