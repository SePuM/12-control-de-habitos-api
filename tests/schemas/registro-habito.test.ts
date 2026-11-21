import { afterEach, describe, expect, it, vi } from "vitest";
import { fechaRegistroSchema } from "@/lib/schemas/registro-habito";

const HOY = "2026-11-21";

describe("fechaRegistroSchema", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("acepta una fecha YYYY-MM-DD de hoy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));

    expect(fechaRegistroSchema.safeParse(HOY).success).toBe(true);
  });

  it("acepta una fecha YYYY-MM-DD pasada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));

    expect(fechaRegistroSchema.safeParse("2026-11-20").success).toBe(true);
  });

  it("rechaza una fecha YYYY-MM-DD futura", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));

    const resultado = fechaRegistroSchema.safeParse("2026-11-22");

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(
        "No se permiten fechas futuras",
      );
    }
  });

  it("rechaza la fecha de mañana aunque falte poco para medianoche UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T23:30:00.000Z"));

    expect(fechaRegistroSchema.safeParse("2026-11-22").success).toBe(false);
  });

  it("conserva el rechazo de datetime ISO del contrato existente", () => {
    expect(
      fechaRegistroSchema.safeParse("2026-11-20T23:30:00-03:00").success,
    ).toBe(false);
  });

  it("rechaza una fecha malformada", () => {
    expect(fechaRegistroSchema.safeParse("21-11-2026").success).toBe(false);
  });
});
