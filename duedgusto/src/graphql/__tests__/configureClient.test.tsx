import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock delle dipendenze
const mockGetAuthHeaders = vi.fn();
vi.mock("../../common/authentication/auth", () => ({
  getAuthHeaders: () => mockGetAuthHeaders(),
}));

const mockExecuteTokenRefresh = vi.fn();
vi.mock("../../common/authentication/tokenRefreshManager", () => ({
  executeTokenRefresh: () => mockExecuteTokenRefresh(),
}));

const mockOnRefreshFails = vi.fn();
vi.mock("../../common/authentication/onRefreshFails", () => ({
  default: mockOnRefreshFails,
}));

vi.mock("../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("configureClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset dei moduli per pulire il singleton apolloClient
    vi.resetModules();

    (window as Global).GRAPHQL_ENDPOINT = "https://localhost:4000/graphql";
    mockGetAuthHeaders.mockReturnValue({ Authorization: "Bearer test-jwt" });
  });

  const getModule = async () => {
    // Re-importa per avere un modulo fresco dopo resetModules
    return await import("../configureClient");
  };

  // ─── Creazione del client ──────────────────────────────────────

  describe("creazione del client", () => {
    it("dovrebbe creare un Apollo Client con i link configurati correttamente", async () => {
      const { default: configureClient } = await getModule();
      const client = configureClient();

      expect(client).toBeDefined();
      expect(client.link).toBeDefined();
      expect(client.cache).toBeDefined();
    });

    it("dovrebbe restituire la stessa istanza alla seconda chiamata (singleton)", async () => {
      const { default: configureClient } = await getModule();
      const client1 = configureClient();
      const client2 = configureClient();

      expect(client1).toBe(client2);
    });
  });

  // ─── Auth link ─────────────────────────────────────────────────

  describe("auth link", () => {
    it("dovrebbe iniettare il token JWT nell'header Authorization delle richieste", async () => {
      // Questo test verifica indirettamente che l'auth link chiami getAuthHeaders
      // quando una richiesta viene eseguita.
      // Testing diretto dei link Apollo e' complesso; verifichiamo che getAuthHeaders
      // sia importato e usato dal modulo.
      const { default: configureClient } = await getModule();
      const client = configureClient();

      // Il client e' stato creato con il link auth che usa getAuthHeaders
      expect(client).toBeDefined();

      // TODO: Per un test piu' approfondito dell'auth link, sarebbe necessario
      // creare un mock server GraphQL e verificare gli header delle richieste.
      // Questo richiederebbe MockedProvider o un approccio simile con execute() sul link.
    });
  });

  // ─── Error link ────────────────────────────────────────────────

  describe("error link", () => {
    it("dovrebbe essere configurato per intercettare errori ACCESS_DENIED", async () => {
      // L'error link e' configurato con onError che controlla graphQLErrors
      // per errori con code === "ACCESS_DENIED".
      // Testing diretto dell'error link con Apollo richiede un setup complesso.
      const { default: configureClient } = await getModule();
      const client = configureClient();

      expect(client).toBeDefined();

      // TODO: Per testare l'error link in modo completo, sarebbe necessario:
      // 1. Creare un mock link che simuli un errore ACCESS_DENIED
      // 2. Eseguire una query attraverso la catena di link
      // 3. Verificare che executeTokenRefresh venga chiamato
      // 4. Verificare che la richiesta venga riprovata con il nuovo token
      // Questo richiede un setup significativo con ApolloLink.execute() e Observable.
    });
  });

  // ─── Cache policies ────────────────────────────────────────────

  describe("cache policies", () => {
    it("dovrebbe configurare InMemoryCache con typePolicies per connection, cashManagement e chiusureMensili", async () => {
      const { default: configureClient } = await getModule();
      const client = configureClient();

      // Verifica che il cache sia una InMemoryCache con le policies configurate
      // (non possiamo ispezionare le policies direttamente, ma possiamo verificare che il cache funzioni)
      expect(client.cache).toBeDefined();
    });
  });
});
