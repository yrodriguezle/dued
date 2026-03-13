import { describe, it, expect } from "vitest";
import getType from "../getType";

describe("getType", () => {
  it("should return 'string' for a string", () => {
    expect(getType("hello")).toBe("string");
  });

  it("should return 'number' for a number", () => {
    expect(getType(42)).toBe("number");
  });

  it("should return 'boolean' for a boolean", () => {
    expect(getType(true)).toBe("boolean");
  });

  it("should return 'null' for null", () => {
    expect(getType(null)).toBe("null");
  });

  it("should return 'undefined' for undefined", () => {
    expect(getType(undefined)).toBe("undefined");
  });

  it("should return 'array' for an array", () => {
    expect(getType([1, 2, 3])).toBe("array");
  });

  it("should return 'object' for a plain object", () => {
    expect(getType({ a: 1 })).toBe("object");
  });

  it("should return 'function' for a function", () => {
    expect(getType(() => {})).toBe("function");
  });

  it("should return 'date' for a Date", () => {
    expect(getType(new Date())).toBe("date");
  });

  it("should return 'regexp' for a RegExp", () => {
    expect(getType(/abc/)).toBe("regexp");
  });

  it("should return 'map' for a Map", () => {
    expect(getType(new Map())).toBe("map");
  });

  it("should return 'set' for a Set", () => {
    expect(getType(new Set())).toBe("set");
  });
});
