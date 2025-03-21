import { describe, it, expect } from "vitest";
import flatMap from "../flatMap";

describe("flatMap", () => {
  it("should map and flatten an array of numbers", () => {
    const numbers = [1, 2, 3];
    const result = flatMap(numbers, (num) => [num, num * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("should map and flatten an object", () => {
    const object = { a: 1, b: 2, c: 3 };
    const result = flatMap(object, (value) => [value, value * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("should handle an empty array", () => {
    const emptyArray: number[] = [];
    const result = flatMap(emptyArray, (num) => [num, num * 2]);
    expect(result).toEqual([]);
  });

  it("should handle an empty object", () => {
    const emptyObject = {};
    const result = flatMap(emptyObject, (value: number) => [value, value * 2]);
    expect(result).toEqual([]);
  });

  it("should handle different types of values in array", () => {
    const mixedArray = [1, "a", true];
    const result = flatMap(mixedArray, (item) => [item, typeof item]);
    expect(result).toEqual([1, "number", "a", "string", true, "boolean"]);
  });

  it("should handle different types of values in object", () => {
    const mixedObject = { a: 1, b: "a", c: true };
    const result = flatMap(mixedObject, (value) => [value, typeof value]);
    expect(result).toEqual([1, "number", "a", "string", true, "boolean"]);
  });
});
