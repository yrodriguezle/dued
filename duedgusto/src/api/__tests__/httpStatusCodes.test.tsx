import { describe, it, expect } from "vitest";
import { WEB_REQUEST_UNAUTHORIZED, WEB_REQUEST_INTERNAL_SERVER_ERROR } from "../httpStatusCodes";

describe("httpStatusCodes", () => {
  it("dovrebbe esportare WEB_REQUEST_UNAUTHORIZED con valore 401", () => {
    expect(WEB_REQUEST_UNAUTHORIZED).toBe(401);
  });

  it("dovrebbe esportare WEB_REQUEST_INTERNAL_SERVER_ERROR con valore 500", () => {
    expect(WEB_REQUEST_INTERNAL_SERVER_ERROR).toBe(500);
  });

  it("WEB_REQUEST_UNAUTHORIZED dovrebbe essere un numero", () => {
    expect(typeof WEB_REQUEST_UNAUTHORIZED).toBe("number");
  });

  it("WEB_REQUEST_INTERNAL_SERVER_ERROR dovrebbe essere un numero", () => {
    expect(typeof WEB_REQUEST_INTERNAL_SERVER_ERROR).toBe("number");
  });

  it("i codici di stato dovrebbero essere diversi tra loro", () => {
    expect(WEB_REQUEST_UNAUTHORIZED).not.toBe(WEB_REQUEST_INTERNAL_SERVER_ERROR);
  });
});
