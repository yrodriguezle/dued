import { describe, it, expect } from "vitest";
import capitalize from "../capitalize";

describe("capitalize", () => {
  it("should capitalize the first letter of a word", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("should capitalize the first letter of a sentence", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });

  it("should handle an already capitalized string", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  it("should handle a single character", () => {
    expect(capitalize("a")).toBe("A");
  });
});
