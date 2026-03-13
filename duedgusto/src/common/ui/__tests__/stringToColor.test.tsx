import { describe, it, expect } from "vitest";
import stringToColor from "../stringToColor";

describe("stringToColor", () => {
  it("dovrebbe restituire un colore in formato esadecimale valido (#XXXXXX)", () => {
    const color = stringToColor("Mario Rossi");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("dovrebbe restituire lo stesso colore per la stessa stringa (deterministico)", () => {
    const color1 = stringToColor("Test User");
    const color2 = stringToColor("Test User");
    expect(color1).toBe(color2);
  });

  it("dovrebbe restituire colori diversi per stringhe diverse", () => {
    const color1 = stringToColor("Alice");
    const color2 = stringToColor("Bob");
    expect(color1).not.toBe(color2);
  });

  it("dovrebbe gestire una stringa vuota", () => {
    const color = stringToColor("");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("dovrebbe gestire stringhe con caratteri speciali", () => {
    const color = stringToColor("Caffè & Tè! @#$%");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
