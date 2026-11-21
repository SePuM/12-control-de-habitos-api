import { z } from "zod";
import { habitoIdSchema } from "@/lib/schemas/habito";

export const fechaRegistroSchema = z.iso.date();

export const registroHabitoSchema = z
  .object({
    cantidad: z.number().int().min(0),
  })
  .strict();

export const registroHabitoParamsSchema = z.object({
  habitoId: habitoIdSchema,
  fecha: fechaRegistroSchema,
});

export const registroHabitoQuerySchema = z.object({
  fecha: fechaRegistroSchema,
});

export const estadisticasQuerySchema = z
  .object({
    fecha: fechaRegistroSchema.optional(),
  })
  .strict();

export type RegistroHabitoInput = z.infer<typeof registroHabitoSchema>;
export type RegistroHabitoParams = z.infer<typeof registroHabitoParamsSchema>;
export type RegistroHabitoQuery = z.infer<typeof registroHabitoQuerySchema>;
export type EstadisticasQuery = z.infer<typeof estadisticasQuerySchema>;
