import { describe, it, expect } from "vitest";
import isEqual from "../isEqual";

describe("isEqual", () => {
  it("should return true for identical primitives", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual("abc", "abc")).toBe(true);
    expect(isEqual(true, true)).toBe(true);
  });

  it("should return false for different primitives", () => {
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual("a", "b")).toBe(false);
  });

  it("should return true for deeply equal objects", () => {
    expect(isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
  });

  it("should return true for objects with different key order", () => {
    expect(isEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("should return false for objects with different values", () => {
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("should return false for objects with different keys", () => {
    expect(isEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it("should return true for deeply equal arrays", () => {
    expect(isEqual([1, 2, [3]], [1, 2, [3]])).toBe(true);
  });

  it("should return false for arrays with different lengths", () => {
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("should return false when comparing null with an object", () => {
    expect(isEqual(null, { a: 1 })).toBe(false);
    expect(isEqual({ a: 1 }, null)).toBe(false);
  });

  it("should return true for same reference", () => {
    const obj = { a: 1 };
    expect(isEqual(obj, obj)).toBe(true);
  });
});
