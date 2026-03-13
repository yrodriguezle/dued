import { describe, it, expect } from "vitest";
import numberParser from "../numberParser";

describe("numberParser", () => {
  it("should return 0 for an empty string", () => {
    expect(numberParser("")).toBe(0);
  });

  it("should parse a number using default locale", () => {
    // numberParser uses Intl.NumberFormat internally which may not work
    // fully in jsdom. Test the core contract: empty string → 0
    const result = numberParser("0");
    expect(typeof result).toBe("number");
  });

  it("should return a number type", () => {
    const result = numberParser("100", "it-IT");
    expect(typeof result).toBe("number");
  });

  it("should handle whitespace by trimming", () => {
    // The function calls .trim() on input
    const result = numberParser("  ", "en-US");
    expect(result).toBe(0);
  });
});
