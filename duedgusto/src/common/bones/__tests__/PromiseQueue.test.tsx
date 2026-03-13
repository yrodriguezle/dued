import { describe, it, expect } from "vitest";
import PromiseQueue from "../PromiseQueue";

describe("PromiseQueue", () => {
  it("should execute operations in order", async () => {
    const queue = new PromiseQueue();
    const results: number[] = [];
    await queue.add(() => new Promise((resolve) => {
      results.push(1);
      resolve(1);
    }));
    await queue.add(() => new Promise((resolve) => {
      results.push(2);
      resolve(2);
    }));
    expect(results).toEqual([1, 2]);
  });

  it("should return the result of each operation", async () => {
    const queue = new PromiseQueue();
    const result = await queue.add(() => Promise.resolve("hello"));
    expect(result).toBe("hello");
  });

  it("should propagate errors", async () => {
    const queue = new PromiseQueue();
    await expect(queue.add(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail");
  });

  it("should continue processing after an error", async () => {
    const queue = new PromiseQueue();
    try {
      await queue.add(() => Promise.reject(new Error("fail")));
    } catch {
      // expected
    }
    const result = await queue.add(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
  });
});
