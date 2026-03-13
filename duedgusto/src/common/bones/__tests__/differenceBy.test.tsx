import { describe, it, expect } from "vitest";
import differenceBy from "../differenceBy";

describe("differenceBy", () => {
  it("should return difference using a string key", () => {
    const arr1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const arr2 = [{ id: 2 }];
    expect(differenceBy(arr1, arr2, "id")).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it("should return difference using an iteratee function", () => {
    const arr1 = [{ x: 1 }, { x: 2 }, { x: 3 }];
    const arr2 = [{ x: 1 }, { x: 3 }];
    expect(differenceBy(arr1, arr2, (item) => item.x)).toEqual([{ x: 2 }]);
  });

  it("should return the full array when no overlap", () => {
    const arr1 = [{ id: 1 }];
    const arr2 = [{ id: 2 }];
    expect(differenceBy(arr1, arr2, "id")).toEqual([{ id: 1 }]);
  });

  it("should return empty array when all elements match", () => {
    const arr1 = [{ id: 1 }];
    const arr2 = [{ id: 1 }];
    expect(differenceBy(arr1, arr2, "id")).toEqual([]);
  });
});
