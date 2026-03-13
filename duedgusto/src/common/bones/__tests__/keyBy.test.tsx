import { describe, it, expect } from "vitest";
import keyBy from "../keyBy";

describe("keyBy", () => {
  it("should key an array of objects by a string property", () => {
    const items = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
    ];
    expect(keyBy(items, "id")).toEqual({
      a: { id: "a", name: "Alice" },
      b: { id: "b", name: "Bob" },
    });
  });

  it("should key by a numeric property", () => {
    const items = [
      { id: 1, value: "x" },
      { id: 2, value: "y" },
    ];
    expect(keyBy(items, "id")).toEqual({
      "1": { id: 1, value: "x" },
      "2": { id: 2, value: "y" },
    });
  });

  it("should overwrite duplicates with the last item", () => {
    const items = [
      { id: 1, v: "first" },
      { id: 1, v: "second" },
    ];
    expect(keyBy(items, "id")).toEqual({ "1": { id: 1, v: "second" } });
  });

  it("should throw if collection is not an array", () => {
    expect(() => keyBy(null as unknown as [], "id")).toThrow("collection must be an array");
  });

  it("should handle an empty array", () => {
    expect(keyBy([], "id")).toEqual({});
  });
});
