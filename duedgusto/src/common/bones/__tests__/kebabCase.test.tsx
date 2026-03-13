import { describe, it, expect } from "vitest";
import kebabCase from "../kebabCase";

describe("kebabCase", () => {
  it("should convert camelCase to kebab-case", () => {
    expect(kebabCase("camelCase")).toBe("camel-case");
  });

  it("should convert spaces to hyphens", () => {
    expect(kebabCase("hello world")).toBe("hello-world");
  });

  it("should convert underscores to hyphens", () => {
    expect(kebabCase("snake_case")).toBe("snake-case");
  });

  it("should remove special characters", () => {
    expect(kebabCase("hello@world!")).toBe("helloworld");
  });

  it("should convert to lowercase", () => {
    expect(kebabCase("HelloWorld")).toBe("hello-world");
  });
});
