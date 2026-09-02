import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useAppHeight from "../useAppHeight";

type FakeViewport = {
  height: number;
  scale: number;
  listeners: Record<string, Array<() => void>>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  emit: (type: string) => void;
};

function createFakeViewport(height: number, scale = 1): FakeViewport {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    height,
    scale,
    listeners,
    addEventListener(type, listener) {
      listeners[type] = [...(listeners[type] ?? []), listener];
    },
    removeEventListener(type, listener) {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    },
    emit(type) {
      (listeners[type] ?? []).forEach((listener) => listener());
    },
  };
}

function setViewport(viewport: FakeViewport | undefined) {
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true, writable: true });
}

function readAppHeight() {
  return document.documentElement.style.getPropertyValue("--app-height");
}

describe("useAppHeight", () => {
  const originalViewport = window.visualViewport;

  beforeEach(() => {
    document.documentElement.style.removeProperty("--app-height");
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });

  afterEach(() => {
    setViewport(originalViewport as unknown as FakeViewport | undefined);
    vi.restoreAllMocks();
  });

  it("pubblica l'altezza del visual viewport al mount", () => {
    setViewport(createFakeViewport(500));
    renderHook(() => useAppHeight());

    expect(readAppHeight()).toBe("500px");
  });

  it("aggiorna l'altezza quando la tastiera riduce il visual viewport", () => {
    const viewport = createFakeViewport(800);
    setViewport(viewport);
    renderHook(() => useAppHeight());

    act(() => {
      viewport.height = 420;
      viewport.emit("resize");
    });

    expect(readAppHeight()).toBe("420px");
  });

  it("annulla lo scroll imposto dal browser quando non c'è zoom", () => {
    const viewport = createFakeViewport(500);
    setViewport(viewport);
    renderHook(() => useAppHeight());

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 180, configurable: true, writable: true });
      viewport.emit("scroll");
    });

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("non tocca lo scroll quando l'utente ha fatto zoom", () => {
    const viewport = createFakeViewport(500, 2);
    setViewport(viewport);
    renderHook(() => useAppHeight());

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 180, configurable: true, writable: true });
      viewport.emit("scroll");
    });

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("usa window.innerHeight quando visualViewport non è disponibile", () => {
    setViewport(undefined);
    Object.defineProperty(window, "innerHeight", { value: 640, configurable: true, writable: true });
    renderHook(() => useAppHeight());

    expect(readAppHeight()).toBe("640px");
  });

  it("rimuove i listener allo smontaggio", () => {
    const viewport = createFakeViewport(500);
    setViewport(viewport);
    const { unmount } = renderHook(() => useAppHeight());

    unmount();

    expect(viewport.listeners.resize).toHaveLength(0);
    expect(viewport.listeners.scroll).toHaveLength(0);
  });
});
