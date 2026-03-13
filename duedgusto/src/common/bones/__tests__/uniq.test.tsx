import { describe, it, expect } from "vitest";
import uniq from "../uniq";

describe("uniq", () => {
  it("should remove duplicate numbers", () => {
    expect(uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it("should remove duplicate strings", () => {
    expect(uniq(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });

  it("should handle an empty array", () => {
    expect(uniq([])).toEqual([]);
  });

  it("should handle an array with no duplicates", () => {
    expect(uniq([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
