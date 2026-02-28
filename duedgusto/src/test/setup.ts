import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup dopo ogni test per evitare memory leak
afterEach(() => {
  cleanup();
});

// Mock di localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock di BroadcastChannel
class BroadcastChannelMock {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  private static channels: Map<string, Set<BroadcastChannelMock>> = new Map();

  constructor(name: string) {
    this.name = name;
    const existing = BroadcastChannelMock.channels.get(name) ?? new Set();
    existing.add(this);
    BroadcastChannelMock.channels.set(name, existing);
  }

  postMessage(message: unknown) {
    const channels = BroadcastChannelMock.channels.get(this.name) ?? new Set();
    channels.forEach((channel) => {
      if (channel !== this && channel.onmessage) {
        channel.onmessage(new MessageEvent("message", { data: message }));
      }
    });
  }

  close() {
    const channels = BroadcastChannelMock.channels.get(this.name);
    if (channels) {
      channels.delete(this);
      if (channels.size === 0) {
        BroadcastChannelMock.channels.delete(this.name);
      }
    }
  }

  addEventListener(_type: string, _listener: EventListener) {
    // Implementazione minima per i test
  }

  removeEventListener(_type: string, _listener: EventListener) {
    // Implementazione minima per i test
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }
}

Object.defineProperty(window, "BroadcastChannel", {
  value: BroadcastChannelMock,
});

// Mock delle variabili globali dell'app (window.API_ENDPOINT, ecc.)
Object.defineProperty(window, "API_ENDPOINT", {
  value: "https://localhost:4000/api",
  writable: true,
});

Object.defineProperty(window, "GRAPHQL_ENDPOINT", {
  value: "https://localhost:4000/graphql",
  writable: true,
});
