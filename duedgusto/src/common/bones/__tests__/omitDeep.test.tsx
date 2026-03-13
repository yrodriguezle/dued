import { describe, it, expect } from "vitest";
import omitDeep from "../omitDeep";

describe("omitDeep", () => {
  it("should omit specified keys from a flat object", () => {
    expect(omitDeep({ a: 1, b: 2, c: 3 }, ["b"])).toEqual({ a: 1, c: 3 });
  });

  it("should omit keys deeply in nested objects", () => {
    const input = { a: 1, nested: { b: 2, __typename: "X" } };
    expect(omitDeep(input, ["__typename"])).toEqual({ a: 1, nested: { b: 2 } });
  });

  it("should omit keys inside arrays of objects", () => {
    const input = [{ a: 1, __typename: "X" }, { b: 2, __typename: "Y" }];
    expect(omitDeep(input, ["__typename"])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("should return primitive values as-is", () => {
    expect(omitDeep("hello", ["a"])).toBe("hello");
    expect(omitDeep(42, ["a"])).toBe(42);
    expect(omitDeep(null, ["a"])).toBe(null);
  });

  it("should handle an empty omit list", () => {
    const input = { a: 1, b: 2 };
    expect(omitDeep(input, [])).toEqual({ a: 1, b: 2 });
  });
});
