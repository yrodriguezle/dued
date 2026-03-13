import { create } from "zustand";
import inProgressStore from "../inProgressStore";

const createInProgressStore = () =>
  create<Pick<Store, "inProgress" | "onInProgress" | "offInProgress">>((set) => ({
    ...inProgressStore(set as StoreSet),
  }));

describe("inProgressStore", () => {
  it("deve avere stato iniziale con oggetto vuoto", () => {
    const store = createInProgressStore();
    const state = store.getState();

    expect(state.inProgress).toEqual({});
  });

  it("deve attivare inProgress per una chiave tramite onInProgress", () => {
    const store = createInProgressStore();

    store.getState().onInProgress("global");

    expect(store.getState().inProgress.global).toBe(true);
  });

  it("deve disattivare inProgress per una chiave tramite offInProgress", () => {
    const store = createInProgressStore();

    store.getState().onInProgress("global");
    expect(store.getState().inProgress.global).toBe(true);

    store.getState().offInProgress("global");
    expect(store.getState().inProgress.global).toBe(false);
  });

  it("deve gestire chiavi multiple indipendentemente", () => {
    const store = createInProgressStore();

    store.getState().onInProgress("global");
    store.getState().onInProgress("save");

    expect(store.getState().inProgress.global).toBe(true);
    expect(store.getState().inProgress.save).toBe(true);

    store.getState().offInProgress("global");

    expect(store.getState().inProgress.global).toBe(false);
    expect(store.getState().inProgress.save).toBe(true);
  });

  it("non deve creare un nuovo oggetto se il valore è già true", () => {
    const store = createInProgressStore();

    store.getState().onInProgress("global");
    const stateBefore = store.getState();

    store.getState().onInProgress("global");
    const stateAfter = store.getState();

    // Lo stato non deve cambiare perché il valore è già true
    expect(stateBefore).toBe(stateAfter);
  });

  it("non deve creare un nuovo oggetto se il valore è già false o undefined", () => {
    const store = createInProgressStore();

    // offInProgress su chiave mai impostata (undefined)
    const stateBefore = store.getState();
    store.getState().offInProgress("nonexistent");
    const stateAfter = store.getState();

    expect(stateBefore).toBe(stateAfter);
  });
});
