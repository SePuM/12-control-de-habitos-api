import { z } from "zod";

export const registroSchema = z
  .object({
    nombre: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
  })
  .strict();

export type RegistroInput = z.infer<typeof registroSchema>;
