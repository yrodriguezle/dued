import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../common/authentication/auth", () => ({
  getAuthHeaders: vi.fn(),
}));

vi.mock("../../common/authentication/onRefreshFails", () => ({
  default: vi.fn(),
}));

vi.mock("../../common/authentication/tokenRefreshManager", () => ({
  executeTokenRefresh: vi.fn(),
}));

vi.mock("../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getAuthHeaders } from "../../common/authentication/auth";
import onRefreshFails from "../../common/authentication/onRefreshFails";
import { executeTokenRefresh } from "../../common/authentication/tokenRefreshManager";
import uploadRequest from "../uploadRequest";

type RispostaSimulata = { status: number; corpo: string };

/**
 * XHR finto: registra ogni istanza creata, così i test possono dimostrare che il retry ne
 * costruisce una **nuova** invece di riusare quella già inviata.
 */
class XhrFinto {
  static istanze: XhrFinto[] = [];
  static risposte: RispostaSimulata[] = [];

  upload = { onprogress: null as ((evento: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  headers: Record<string, string> = {};
  withCredentials = false;
  status = 0;
  responseText = "";
  metodo = "";
  url = "";
  inviato = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    XhrFinto.istanze.push(this);
  }

  open(metodo: string, url: string) {
    this.metodo = metodo;
    this.url = url;
  }

  setRequestHeader(nome: string, valore: string) {
    this.headers[nome] = valore;
  }

  send() {
    if (this.inviato) {
      throw new Error("XHR già inviato: non è reinviabile");
    }
    this.inviato = true;
    const risposta = XhrFinto.risposte.shift() ?? { status: 200, corpo: "{}" };
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    this.status = risposta.status;
    this.responseText = risposta.corpo;
    queueMicrotask(() => this.onload?.());
  }
}

function formDataDiProva(): FormData {
  const formData = new FormData();
  formData.append("file", new Blob(["contenuto"], { type: "image/jpeg" }), "foto.jpg");
  return formData;
}

describe("uploadRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    XhrFinto.istanze = [];
    XhrFinto.risposte = [];
    vi.mocked(getAuthHeaders).mockReturnValue({ Authorization: "Bearer token-1" });
    vi.mocked(onRefreshFails).mockResolvedValue(undefined);
    vi.mocked(executeTokenRefresh).mockResolvedValue(false);
    (window as Global).API_ENDPOINT = "https://localhost:4000";
    vi.stubGlobal("XMLHttpRequest", XhrFinto);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invia il multipart senza Content-Type e restituisce il corpo JSON", async () => {
    XhrFinto.risposte = [{ status: 201, corpo: JSON.stringify({ mediaAssetId: 7 }) }];

    const risultato = await uploadRequest<{ mediaAssetId: number }>({ path: "media", formData: formDataDiProva() });

    expect(risultato).toEqual({ mediaAssetId: 7 });
    expect(XhrFinto.istanze).toHaveLength(1);
    expect(XhrFinto.istanze[0].url).toBe("https://localhost:4000/api/media");
    // Il boundary lo genera il browser: un Content-Type nostro renderebbe il corpo illeggibile.
    expect(XhrFinto.istanze[0].headers["Content-Type"]).toBeUndefined();
    expect(XhrFinto.istanze[0].withCredentials).toBe(true);
  });

  // ── 7.12 — il retry è fatto bene ───────────────────────────────────────────
  it("dopo un 401 rinnova il token e ritenta con un XHR nuovo e gli header riletti", async () => {
    XhrFinto.risposte = [
      { status: 401, corpo: "" },
      { status: 201, corpo: JSON.stringify({ mediaAssetId: 9 }) },
    ];
    vi.mocked(executeTokenRefresh).mockResolvedValueOnce(true);
    vi.mocked(getAuthHeaders).mockReturnValueOnce({ Authorization: "Bearer scaduto" }).mockReturnValueOnce({ Authorization: "Bearer rinnovato" });

    const risultato = await uploadRequest<{ mediaAssetId: number }>({ path: "media", formData: formDataDiProva() });

    expect(risultato).toEqual({ mediaAssetId: 9 });
    // Due istanze DIVERSE: un XHR già inviato non è reinviabile.
    expect(XhrFinto.istanze).toHaveLength(2);
    expect(XhrFinto.istanze[0]).not.toBe(XhrFinto.istanze[1]);
    // Due letture degli header: è la classe di bug "rimando lo stesso token scaduto".
    expect(getAuthHeaders).toHaveBeenCalledTimes(2);
    expect(XhrFinto.istanze[0].headers.Authorization).toBe("Bearer scaduto");
    expect(XhrFinto.istanze[1].headers.Authorization).toBe("Bearer rinnovato");
  });

  // ── 7.13 — un solo retry, e progresso azzerato a ogni tentativo ────────────
  it("non tenta una terza volta e chiude la sessione se anche il retry riceve 401", async () => {
    XhrFinto.risposte = [
      { status: 401, corpo: "" },
      { status: 401, corpo: "" },
    ];
    vi.mocked(executeTokenRefresh).mockResolvedValueOnce(true);

    const progressi: number[] = [];
    const risultato = await uploadRequest({
      path: "media",
      formData: formDataDiProva(),
      onProgress: (avanzamento) => progressi.push(avanzamento),
    });

    expect(risultato).toBeNull();
    expect(XhrFinto.istanze).toHaveLength(2);
    expect(executeTokenRefresh).toHaveBeenCalledOnce();
    expect(onRefreshFails).toHaveBeenCalledOnce();
    // Ogni tentativo riparte da 0: senza, la barra tornerebbe indietro e sembrerebbe rotta.
    expect(progressi).toEqual([0, 0.5, 0, 0.5]);
  });

  it("restituisce null senza ritentare quando il refresh fallisce", async () => {
    XhrFinto.risposte = [{ status: 401, corpo: "" }];
    vi.mocked(executeTokenRefresh).mockResolvedValueOnce(false);

    const risultato = await uploadRequest({ path: "media", formData: formDataDiProva() });

    expect(risultato).toBeNull();
    expect(XhrFinto.istanze).toHaveLength(1);
    expect(onRefreshFails).toHaveBeenCalledOnce();
  });

  // ── 7.14 — il 413 di nginx ha un corpo HTML ───────────────────────────────
  it("traduce un 413 con corpo HTML in un messaggio leggibile, senza SyntaxError", async () => {
    XhrFinto.risposte = [{ status: 413, corpo: "<html><head><title>413 Request Entity Too Large</title></head></html>" }];

    await expect(uploadRequest({ path: "media", formData: formDataDiProva() })).rejects.toThrow("Il file supera il limite consentito dal server");
  });

  it("propaga il messaggio del server quando il corpo dell'errore è JSON", async () => {
    XhrFinto.risposte = [{ status: 403, corpo: JSON.stringify({ message: "Operazione riservata agli amministratori" }) }];

    await expect(uploadRequest({ path: "media", formData: formDataDiProva() })).rejects.toThrow("Operazione riservata agli amministratori");
  });
});
