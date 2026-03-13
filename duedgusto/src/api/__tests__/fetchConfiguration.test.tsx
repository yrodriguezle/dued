import { describe, it, expect, vi, beforeEach } from "vitest";

describe("fetchConfiguration", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    vi.resetModules();
  });

  const getModule = async () => {
    return await import("../fetchConfiguration");
  };

  it("dovrebbe chiamare fetch con /config.json e gli header corretti", async () => {
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const { default: fetchConfiguration } = await getModule();
    await fetchConfiguration();

    expect(mockFetch).toHaveBeenCalledWith("/config.json", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });
  });

  it("dovrebbe restituire la risposta del fetch", async () => {
    const configData = { API_ENDPOINT: "https://localhost:4000" };
    const mockResponse = { ok: true, json: vi.fn().mockResolvedValue(configData) };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const { default: fetchConfiguration } = await getModule();
    const response = await fetchConfiguration();

    expect(response).toBe(mockResponse);
  });

  it("dovrebbe propagare l'errore quando fetch fallisce", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { default: fetchConfiguration } = await getModule();

    await expect(fetchConfiguration()).rejects.toThrow("Network error");
  });

  it("dovrebbe usare cache: no-store per evitare risposte cached", async () => {
    const mockResponse = { ok: true };
    mockFetch.mockResolvedValueOnce(mockResponse);

    const { default: fetchConfiguration } = await getModule();
    await fetchConfiguration();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: "no-store" })
    );
  });
});
