import { describe, it, expect } from "vitest";
import reportError from "../reportError";

describe("reportError", () => {
  it("should return the message from an Error instance", () => {
    expect(reportError(new Error("something went wrong"))).toBe("something went wrong");
  });

  it("should return null for a non-Error value", () => {
    expect(reportError("string error")).toBe(null);
  });

  it("should return null for null", () => {
    expect(reportError(null)).toBe(null);
  });

  it("should return null for undefined", () => {
    expect(reportError(undefined)).toBe(null);
  });
});
