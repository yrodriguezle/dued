import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useVersionCheck from "../useVersionCheck";
import fetchConfiguration from "../../../api/fetchConfiguration";

vi.mock("../../../api/fetchConfiguration");

const mockedFetchConfiguration = vi.mocked(fetchConfiguration);

function mockConfigResponse(config: Partial<Global>, ok = true) {
  mockedFetchConfiguration.mockResolvedValue({
    ok,
    json: () => Promise.resolve(config),
  } as Response);
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVersionCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (window as Global).appVersion = "1.0.0";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete (window as Global).appVersion;
  });

  it("segnala update quando la versione remota è diversa", async () => {
    mockConfigResponse({ APP_VERSION: "1.0.1" });
    const { result } = renderHook(() => useVersionCheck());

    expect(result.current).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it("non segnala update quando la versione è uguale", async () => {
    mockConfigResponse({ APP_VERSION: "1.0.0" });
    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  it("non segnala update se config.json non contiene APP_VERSION (sviluppo)", async () => {
    mockConfigResponse({});
    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  it("controlla la versione quando la scheda torna visibile", async () => {
    mockConfigResponse({ APP_VERSION: "2.0.0" });
    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      fireVisibilityChange();
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it("ignora errori di rete e resta silenzioso", async () => {
    mockedFetchConfiguration.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  it("interrompe il polling dopo aver rilevato un update", async () => {
    mockConfigResponse({ APP_VERSION: "1.0.1" });
    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000);
      await Promise.resolve();
    });
    expect(result.current).toBe(true);

    mockedFetchConfiguration.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(15 * 60_000);
      await Promise.resolve();
    });

    expect(mockedFetchConfiguration).not.toHaveBeenCalled();
  });
});
