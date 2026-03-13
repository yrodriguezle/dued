import { create } from "zustand";
import confirmDialogStore from "../confirmDialogStore";

const createConfirmDialogStore = () =>
  create<Pick<Store, "confirmDialog" | "setConfirmValues">>((set) => ({
    ...confirmDialogStore(set as StoreSet),
  }));

describe("confirmDialogStore", () => {
  it("deve avere stato iniziale con dialog chiuso", () => {
    const store = createConfirmDialogStore();
    const state = store.getState();

    expect(state.confirmDialog.open).toBe(false);
    expect(state.confirmDialog.title).toBe("");
    expect(state.confirmDialog.content).toBe("");
    expect(state.confirmDialog.acceptLabel).toBe("Ok");
    expect(state.confirmDialog.cancelLabel).toBe("");
  });

  it("deve aprire il dialog tramite setConfirmValues", () => {
    const store = createConfirmDialogStore();
    const mockOnAccept = vi.fn();

    store.getState().setConfirmValues({
      open: true,
      title: "Conferma eliminazione",
      content: "Sei sicuro di voler eliminare questo elemento?",
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
      onAccept: mockOnAccept,
    });

    const state = store.getState();
    expect(state.confirmDialog.open).toBe(true);
    expect(state.confirmDialog.title).toBe("Conferma eliminazione");
    expect(state.confirmDialog.content).toBe("Sei sicuro di voler eliminare questo elemento?");
    expect(state.confirmDialog.acceptLabel).toBe("Elimina");
    expect(state.confirmDialog.cancelLabel).toBe("Annulla");
  });

  it("deve chiudere il dialog resettando open a false", () => {
    const store = createConfirmDialogStore();
    const mockOnAccept = vi.fn();

    store.getState().setConfirmValues({
      open: true,
      title: "Test",
      content: "Contenuto",
      onAccept: mockOnAccept,
    });
    expect(store.getState().confirmDialog.open).toBe(true);

    store.getState().setConfirmValues({
      open: false,
      title: "",
      content: "",
      onAccept: () => Promise.resolve(true),
    });
    expect(store.getState().confirmDialog.open).toBe(false);
  });

  it("deve eseguire la callback onAccept quando invocata", () => {
    const store = createConfirmDialogStore();
    const mockOnAccept = vi.fn();

    store.getState().setConfirmValues({
      open: true,
      title: "Conferma",
      content: "Procedere?",
      onAccept: mockOnAccept,
    });

    store.getState().confirmDialog.onAccept(true);
    expect(mockOnAccept).toHaveBeenCalledOnce();
    expect(mockOnAccept).toHaveBeenCalledWith(true);
  });

  it("deve eseguire la callback onCancel quando presente e invocata", () => {
    const store = createConfirmDialogStore();
    const mockOnAccept = vi.fn();
    const mockOnCancel = vi.fn();

    store.getState().setConfirmValues({
      open: true,
      title: "Conferma",
      content: "Procedere?",
      onAccept: mockOnAccept,
      onCancel: mockOnCancel,
    });

    store.getState().confirmDialog.onCancel?.(false);
    expect(mockOnCancel).toHaveBeenCalledOnce();
    expect(mockOnCancel).toHaveBeenCalledWith(false);
  });

  it("deve fare merge parziale dei valori tramite setConfirmValues", () => {
    const store = createConfirmDialogStore();
    const mockOnAccept = vi.fn();

    store.getState().setConfirmValues({
      open: true,
      title: "Titolo iniziale",
      content: "Contenuto iniziale",
      onAccept: mockOnAccept,
    });

    // Aggiorna solo il titolo
    store.getState().setConfirmValues({
      open: true,
      title: "Titolo aggiornato",
      content: "Contenuto iniziale",
      onAccept: mockOnAccept,
    });

    const state = store.getState();
    expect(state.confirmDialog.title).toBe("Titolo aggiornato");
    expect(state.confirmDialog.content).toBe("Contenuto iniziale");
  });
});
