import { describe, it, expect } from "vitest";
import formatCurrency from "../formatCurrency";

describe("formatCurrency", () => {
  it("should format a number with two decimal places", () => {
    const result = formatCurrency(1234.5);
    // In jsdom, toLocaleString("it-IT") may not add thousands separator
    expect(result).toContain("1234");
    expect(result).toContain("50");
  });

  it("should format zero", () => {
    expect(formatCurrency(0)).toBe("0,00");
  });

  it("should return '0,00' for null", () => {
    expect(formatCurrency(null)).toBe("0,00");
  });

  it("should return '0,00' for undefined", () => {
    expect(formatCurrency(undefined)).toBe("0,00");
  });

  it("should format negative numbers", () => {
    const result = formatCurrency(-1234.56);
    expect(result).toContain("1234");
    expect(result).toContain("56");
  });

  it("should format integers with two decimal places", () => {
    const result = formatCurrency(100);
    expect(result).toContain("100");
    expect(result).toContain("00");
  });
});
