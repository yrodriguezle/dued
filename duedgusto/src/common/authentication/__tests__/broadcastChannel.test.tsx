import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock delle dipendenze
const mockSetAuthToken = vi.fn();
vi.mock("../auth", () => ({
  setAuthToken: (...args: unknown[]) => mockSetAuthToken(...args),
}));

const mockOnRefreshFails = vi.fn();
vi.mock("../onRefreshFails", () => ({
  default: mockOnRefreshFails,
}));

vi.mock("../../logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("broadcastChannel", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset del modulo per pulire lo stato interno (channel = null)
    vi.resetModules();
  });

  const getModule = async () => {
    return await import("../broadcastChannel");
  };

  // ─── initAuthChannel ────────────────────────────────────────────

  describe("initAuthChannel", () => {
    it("dovrebbe inizializzare il canale BroadcastChannel", async () => {
      const { initAuthChannel, cleanupAuthChannel } = await getModule();

      initAuthChannel();

      // Il canale e' stato inizializzato, verifichiamo che broadcastLogout non lanci errore
      const { broadcastLogout } = await getModule();
      expect(() => broadcastLogout()).not.toThrow();

      cleanupAuthChannel();
    });

    it("dovrebbe evitare inizializzazioni multiple", async () => {
      const { initAuthChannel, cleanupAuthChannel } = await getModule();

      initAuthChannel();
      initAuthChannel(); // seconda chiamata - non dovrebbe creare un nuovo canale

      // Se fosse stato creato un secondo canale, avremmo problemi con i messaggi
      cleanupAuthChannel();
    });
  });

  // ─── Ricezione messaggi TOKEN_REFRESHED ─────────────────────────

  describe("ricezione messaggio TOKEN_REFRESHED", () => {
    it("dovrebbe aggiornare il token quando riceve TOKEN_REFRESHED da un'altra tab", async () => {
      const { initAuthChannel, cleanupAuthChannel } = await getModule();

      // Simula due "tab" con lo stesso canale
      initAuthChannel(); // tab ricevente

      const senderChannel = new BroadcastChannel("duedgusto-auth");

      const mockToken: AuthToken = { token: "new-jwt-token", refreshToken: "new-refresh" };
      senderChannel.postMessage({
        type: "TOKEN_REFRESHED",
        payload: mockToken,
      });

      expect(mockSetAuthToken).toHaveBeenCalledWith(mockToken);

      senderChannel.close();
      cleanupAuthChannel();
    });
  });

  // ─── Ricezione messaggi LOGOUT ──────────────────────────────────

  describe("ricezione messaggio LOGOUT", () => {
    it("dovrebbe eseguire onRefreshFails quando riceve LOGOUT da un'altra tab", async () => {
      const { initAuthChannel, cleanupAuthChannel } = await getModule();

      initAuthChannel();

      const senderChannel = new BroadcastChannel("duedgusto-auth");
      senderChannel.postMessage({ type: "LOGOUT" });

      expect(mockOnRefreshFails).toHaveBeenCalled();

      senderChannel.close();
      cleanupAuthChannel();
    });
  });

  // ─── broadcastLogout ────────────────────────────────────────────

  describe("broadcastLogout", () => {
    it("dovrebbe inviare un messaggio LOGOUT alle altre tab", async () => {
      const { initAuthChannel, broadcastLogout, cleanupAuthChannel } = await getModule();

      initAuthChannel();

      // Crea un canale "ricevente" (simulando un'altra tab)
      const receiverChannel = new BroadcastChannel("duedgusto-auth");
      const receivedMessages: unknown[] = [];
      receiverChannel.onmessage = (event: MessageEvent) => {
        receivedMessages.push(event.data);
      };

      broadcastLogout();

      expect(receivedMessages).toContainEqual({ type: "LOGOUT" });

      receiverChannel.close();
      cleanupAuthChannel();
    });

    it("non dovrebbe lanciare errori se il canale non e' inizializzato", async () => {
      const { broadcastLogout } = await getModule();

      // Il canale non e' stato inizializzato, quindi broadcastLogout non dovrebbe fare nulla
      expect(() => broadcastLogout()).not.toThrow();
    });
  });

  // ─── broadcastTokenRefreshed ────────────────────────────────────

  describe("broadcastTokenRefreshed", () => {
    it("dovrebbe inviare TOKEN_REFRESHED alle altre tab", async () => {
      const { initAuthChannel, broadcastTokenRefreshed, cleanupAuthChannel } = await getModule();

      initAuthChannel();

      const receiverChannel = new BroadcastChannel("duedgusto-auth");
      const receivedMessages: unknown[] = [];
      receiverChannel.onmessage = (event: MessageEvent) => {
        receivedMessages.push(event.data);
      };

      const mockToken: AuthToken = { token: "jwt-123", refreshToken: "ref-456" };
      broadcastTokenRefreshed(mockToken);

      expect(receivedMessages).toContainEqual({
        type: "TOKEN_REFRESHED",
        payload: mockToken,
      });

      receiverChannel.close();
      cleanupAuthChannel();
    });

    it("non dovrebbe lanciare errori se il canale non e' inizializzato", async () => {
      const { broadcastTokenRefreshed } = await getModule();

      const mockToken: AuthToken = { token: "jwt-123", refreshToken: "ref-456" };
      expect(() => broadcastTokenRefreshed(mockToken)).not.toThrow();
    });
  });

  // ─── cleanupAuthChannel ─────────────────────────────────────────

  describe("cleanupAuthChannel", () => {
    it("dovrebbe chiudere il canale e impedire invii futuri", async () => {
      const { initAuthChannel, cleanupAuthChannel, broadcastLogout } = await getModule();

      initAuthChannel();
      cleanupAuthChannel();

      // Dopo la chiusura, broadcastLogout non dovrebbe inviare nulla
      const receiverChannel = new BroadcastChannel("duedgusto-auth");
      const receivedMessages: unknown[] = [];
      receiverChannel.onmessage = (event: MessageEvent) => {
        receivedMessages.push(event.data);
      };

      broadcastLogout();

      expect(receivedMessages).toHaveLength(0);

      receiverChannel.close();
    });
  });

  // ─── Messaggi non riconosciuti ──────────────────────────────────

  describe("messaggi non riconosciuti", () => {
    it("dovrebbe ignorare messaggi con tipo sconosciuto", async () => {
      const { initAuthChannel, cleanupAuthChannel } = await getModule();

      initAuthChannel();

      const senderChannel = new BroadcastChannel("duedgusto-auth");
      senderChannel.postMessage({ type: "UNKNOWN_TYPE" });

      // Non dovrebbe chiamare ne' setAuthToken ne' onRefreshFails
      expect(mockSetAuthToken).not.toHaveBeenCalled();
      expect(mockOnRefreshFails).not.toHaveBeenCalled();

      senderChannel.close();
      cleanupAuthChannel();
    });
  });
});
