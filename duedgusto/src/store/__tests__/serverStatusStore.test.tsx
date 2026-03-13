import { create } from "zustand";
import serverStatusStore, { ONLINE, OFFLINE } from "../serverStatusStore";

const createServerStatusStore = () =>
  create<Pick<Store, "serverStatus" | "receiveServerStatus">>((set) => ({
    ...serverStatusStore(set as StoreSet),
  }));

describe("serverStatusStore", () => {
  it("deve avere stato iniziale ONLINE", () => {
    const store = createServerStatusStore();
    const state = store.getState();

    expect(state.serverStatus).toBe(ONLINE);
    expect(state.serverStatus).toBe("ONLINE");
  });

  it("deve impostare lo stato a OFFLINE", () => {
    const store = createServerStatusStore();

    store.getState().receiveServerStatus(OFFLINE);

    expect(store.getState().serverStatus).toBe("OFFLINE");
  });

  it("deve impostare lo stato a ONLINE", () => {
    const store = createServerStatusStore();

    store.getState().receiveServerStatus(OFFLINE);
    expect(store.getState().serverStatus).toBe("OFFLINE");

    store.getState().receiveServerStatus(ONLINE);
    expect(store.getState().serverStatus).toBe("ONLINE");
  });

  it("deve esportare le costanti ONLINE e OFFLINE", () => {
    expect(ONLINE).toBe("ONLINE");
    expect(OFFLINE).toBe("OFFLINE");
  });
});
