import { describe, it, expect } from "vitest";
import defaultValue from "../defaultValue";

describe("defaultValue", () => {
  it("should return 0 for a number", () => {
    expect(defaultValue(42)).toBe(0);
  });

  it("should return empty string for a string", () => {
    expect(defaultValue("hello")).toBe("");
  });

  it("should return false for a boolean", () => {
    expect(defaultValue(true)).toBe(false);
  });

  it("should return null for a Date", () => {
    expect(defaultValue(new Date())).toBe(null);
  });

  it("should return null for null", () => {
    expect(defaultValue(null)).toBe(null);
  });

  it("should return undefined for unrecognized types", () => {
    expect(defaultValue(undefined)).toBe(undefined);
    expect(defaultValue({ a: 1 })).toBe(undefined);
    expect(defaultValue([1, 2])).toBe(undefined);
  });
});
