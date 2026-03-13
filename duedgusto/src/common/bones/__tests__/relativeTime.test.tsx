import { describe, it, expect, vi, afterEach } from "vitest";
import relativeTime from "../relativeTime";
import { relativeTimeString } from "../relativeTimeString";

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a string for seconds ago", () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    const tenSecondsAgo = new Date(now.getTime() - 10000);
    const result = relativeTime(tenSecondsAgo);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return a string for minutes ago", () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const result = relativeTime(fiveMinutesAgo);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return a string for hours ago", () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const result = relativeTime(twoHoursAgo);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should return a string for days ago", () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const result = relativeTime(threeDaysAgo);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("relativeTimeString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a string for a recent date", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const result = relativeTimeString(new Date(now - 30000), "en");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should accept a timestamp number", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const result = relativeTimeString(now - 60000, "en");
    expect(typeof result).toBe("string");
  });
});
