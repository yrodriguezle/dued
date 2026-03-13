import { describe, it, expect, vi, afterEach } from "vitest";
import sleep from "../sleep";

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve after the specified time", async () => {
    vi.useFakeTimers();
    let resolved = false;
    sleep(1000).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("should resolve with true", async () => {
    vi.useFakeTimers();
    const promise = sleep(500);
    vi.advanceTimersByTime(500);
    const result = await promise;
    expect(result).toBe(true);
  });

  it("should not resolve before the specified time", async () => {
    vi.useFakeTimers();
    let resolved = false;
    sleep(1000).then(() => {
      resolved = true;
    });
    vi.advanceTimersByTime(999);
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});
