import { describe, it, expect } from "vitest";
import unionBy from "../unionBy";

describe("unionBy", () => {
  it("should merge two arrays keeping unique items by iteratee", () => {
    const arr1 = [{ id: 1, name: "a" }];
    const arr2 = [{ id: 2, name: "b" }];
    const result = unionBy(arr1, arr2, (item) => item.id);
    expect(result).toEqual([{ id: 1, name: "a" }, { id: 2, name: "b" }]);
  });

  it("should prefer values from the first array for duplicates", () => {
    const arr1 = [{ id: 1, name: "first" }];
    const arr2 = [{ id: 1, name: "second" }];
    const result = unionBy(arr1, arr2, (item) => item.id);
    expect(result[0].name).toBe("first");
  });

  it("should sort results by iteratee value", () => {
    const arr1 = [{ id: 3 }];
    const arr2 = [{ id: 1 }, { id: 2 }];
    const result = unionBy(arr1, arr2, (item) => item.id);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("should handle empty arrays", () => {
    const result = unionBy([], [{ id: 1 }], (item: { id: number }) => item.id);
    expect(result).toEqual([{ id: 1 }]);
  });
});
