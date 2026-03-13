import { describe, it, expect, vi, afterEach } from "vitest";
import debounce from "../debounce";

describe("debounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delay function execution", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should cancel previous calls when called again within wait period", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to the debounced function", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a", "b");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("should support cancel method", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it("should return a promise that resolves with the function result", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockReturnValue(42);
    const debounced = debounce(fn, 100);
    const promise = debounced();
    vi.advanceTimersByTime(100);
    const result = await promise;
    expect(result).toBe(42);
  });
});
