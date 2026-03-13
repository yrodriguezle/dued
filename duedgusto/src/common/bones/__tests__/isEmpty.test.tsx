import { describe, it, expect } from "vitest";
import isEmpty from "../isEmpty";

describe("isEmpty", () => {
  it("should return true for null", () => {
    expect(isEmpty(null)).toBe(true);
  });

  it("should return true for undefined", () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it("should return true for an empty string", () => {
    expect(isEmpty("")).toBe(true);
  });

  it("should return true for an empty array", () => {
    expect(isEmpty([])).toBe(true);
  });

  it("should return true for an empty object", () => {
    expect(isEmpty({})).toBe(true);
  });

  it("should return false for a non-empty string", () => {
    expect(isEmpty("hello")).toBe(false);
  });

  it("should return false for a non-empty array", () => {
    expect(isEmpty([1, 2])).toBe(false);
  });

  it("should return false for a non-empty object", () => {
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it("should return false for number 0", () => {
    expect(isEmpty(0)).toBe(false);
  });

  it("should return false for boolean false", () => {
    expect(isEmpty(false)).toBe(false);
  });
});
