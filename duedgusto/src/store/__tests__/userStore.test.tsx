import { create } from "zustand";
import userStore from "../userStore";

const createUserStore = () => create<Pick<Store, "utente" | "receiveUtente">>((set) => ({
  ...userStore(set as StoreSet),
}));

describe("userStore", () => {
  it("deve avere stato iniziale con utente null", () => {
    const store = createUserStore();
    const state = store.getState();

    expect(state.utente).toBeNull();
  });

  it("deve aggiornare utente tramite receiveUtente", () => {
    const store = createUserStore();
    const mockUtente: Utente = {
      __typename: "Utente",
      id: 1,
      nomeUtente: "admin",
      nome: "Mario",
      cognome: "Rossi",
      descrizione: "Amministratore",
      disabilitato: false,
      ruoloId: 1,
      ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "Amministratore" } as Ruolo,
      menus: [],
    };

    store.getState().receiveUtente(mockUtente);

    const state = store.getState();
    expect(state.utente).not.toBeNull();
    expect(state.utente?.nomeUtente).toBe("admin");
    expect(state.utente?.nome).toBe("Mario");
    expect(state.utente?.cognome).toBe("Rossi");
    expect(state.utente?.id).toBe(1);
  });

  it("deve esporre ruolo e permessi dall'utente", () => {
    const store = createUserStore();
    const mockUtente: Utente = {
      __typename: "Utente",
      id: 1,
      nomeUtente: "cassiere",
      nome: "Luigi",
      cognome: "Verdi",
      descrizione: "Cassiere",
      disabilitato: false,
      ruoloId: 2,
      ruolo: { __typename: "Ruolo", id: 2, nome: "Cassiere", descrizione: "Cassiere" } as Ruolo,
      menus: [
        {
          __typename: "Menu",
          id: 1,
          menuPadreId: null,
          titolo: "Dashboard",
          percorso: "/gestionale/dashboard",
          icona: "dashboard",
          visibile: true,
          posizione: 1,
          percorsoFile: "dashboard/HomePage.tsx",
        },
      ],
    };

    store.getState().receiveUtente(mockUtente);

    const state = store.getState();
    expect(state.utente?.ruolo?.nome).toBe("Cassiere");
    expect(state.utente?.ruoloId).toBe(2);
    expect(state.utente?.menus).toHaveLength(1);
    expect(state.utente?.menus[0]?.titolo).toBe("Dashboard");
  });

  it("deve resettare utente impostando null", () => {
    const store = createUserStore();
    const mockUtente: Utente = {
      __typename: "Utente",
      id: 1,
      nomeUtente: "admin",
      nome: "Mario",
      cognome: "Rossi",
      descrizione: "Admin",
      disabilitato: false,
      ruoloId: 1,
      ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "Admin" } as Ruolo,
      menus: [],
    };

    store.getState().receiveUtente(mockUtente);
    expect(store.getState().utente).not.toBeNull();

    store.getState().receiveUtente(null);
    expect(store.getState().utente).toBeNull();
  });

  it("deve sostituire utente con uno nuovo", () => {
    const store = createUserStore();
    const utente1: Utente = {
      __typename: "Utente",
      id: 1,
      nomeUtente: "admin",
      nome: "Mario",
      cognome: "Rossi",
      descrizione: "Admin",
      disabilitato: false,
      ruoloId: 1,
      ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "Admin" } as Ruolo,
      menus: [],
    };
    const utente2: Utente = {
      __typename: "Utente",
      id: 2,
      nomeUtente: "cassiere",
      nome: "Luigi",
      cognome: "Verdi",
      descrizione: "Cassiere",
      disabilitato: false,
      ruoloId: 2,
      ruolo: { __typename: "Ruolo", id: 2, nome: "Cassiere", descrizione: "Cassiere" } as Ruolo,
      menus: [],
    };

    store.getState().receiveUtente(utente1);
    expect(store.getState().utente?.nomeUtente).toBe("admin");

    store.getState().receiveUtente(utente2);
    expect(store.getState().utente?.nomeUtente).toBe("cassiere");
    expect(store.getState().utente?.id).toBe(2);
  });
});
