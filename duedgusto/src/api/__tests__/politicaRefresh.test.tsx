import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../common/authentication/onRefreshFails", () => ({
  default: vi.fn(),
}));

vi.mock("../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import onRefreshFails from "../../common/authentication/onRefreshFails";
import { valutaStatoAutenticazione } from "../politicaRefresh";

/**
 * La politica si prova in isolamento perché è l'unico modo di dimostrare che **non conosce il
 * trasporto**: qui non esistono né fetch né XHR, e le decisioni restano le stesse.
 */
describe("valutaStatoAutenticazione", () => {
  const refreshToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onRefreshFails).mockResolvedValue(undefined);
  });

  it("procede su uno status che non è 401, senza tentare alcun refresh", async () => {
    const esito = await valutaStatoAutenticazione(200, { failOnForbidden: false, refreshToken });

    expect(esito).toBe("procedi");
    expect(refreshToken).not.toHaveBeenCalled();
    expect(onRefreshFails).not.toHaveBeenCalled();
  });

  it("procede anche su un 403: non è la sua materia", async () => {
    const esito = await valutaStatoAutenticazione(403, { failOnForbidden: false, refreshToken });

    expect(esito).toBe("procedi");
    expect(refreshToken).not.toHaveBeenCalled();
  });

  it("abbandona su 401 con failOnForbidden, senza rinnovare nulla", async () => {
    const esito = await valutaStatoAutenticazione(401, { failOnForbidden: true, refreshToken });

    expect(esito).toBe("abbandona");
    // È l'ultimo tentativo: un secondo refresh qui aprirebbe un ciclo fra 401 e rinnovo.
    expect(refreshToken).not.toHaveBeenCalled();
    // E non è la politica a chiudere la sessione: decide chi chiama.
    expect(onRefreshFails).not.toHaveBeenCalled();
  });

  it("chiede di riprovare quando il refresh riesce", async () => {
    refreshToken.mockResolvedValueOnce(true);

    const esito = await valutaStatoAutenticazione(401, { failOnForbidden: false, refreshToken });

    expect(esito).toBe("riprova");
    expect(refreshToken).toHaveBeenCalledOnce();
    expect(onRefreshFails).not.toHaveBeenCalled();
  });

  it("abbandona e chiude la sessione quando il refresh fallisce", async () => {
    refreshToken.mockResolvedValueOnce(false);

    const esito = await valutaStatoAutenticazione(401, { failOnForbidden: false, refreshToken });

    expect(esito).toBe("abbandona");
    expect(onRefreshFails).toHaveBeenCalledOnce();
  });
});
