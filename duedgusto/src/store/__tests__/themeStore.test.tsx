import { create } from "zustand";
import themeStore from "../themeStore";

// Mock del modulo theme
vi.mock("../../components/theme/theme", () => ({
  getDefaultTheme: vi.fn(() => "light"),
  getLastUserThemeMode: vi.fn(() => "default"),
  setLastUserThemeMode: vi.fn(),
}));

const createThemeStore = () =>
  create<Pick<Store, "userTheme" | "changeTheme">>((set) => ({
    ...themeStore(set as StoreSet),
  }));

describe("themeStore", () => {
  beforeEach(() => {
    // Prepara il DOM per i test
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
  });

  afterEach(() => {
    const root = document.getElementById("root");
    if (root) root.remove();
    document.documentElement.removeAttribute("data-theme");
  });

  it("deve avere stato iniziale con tema di default", () => {
    const store = createThemeStore();
    const state = store.getState();

    expect(state.userTheme).toBeDefined();
    expect(state.userTheme.mode).toBe("default");
    expect(state.userTheme.theme).toBe("light");
  });

  it("deve cambiare tema a dark", () => {
    const store = createThemeStore();

    store.getState().changeTheme("dark");

    const state = store.getState();
    expect(state.userTheme.mode).toBe("dark");
    expect(state.userTheme.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("deve cambiare tema a light", () => {
    const store = createThemeStore();

    store.getState().changeTheme("dark");
    store.getState().changeTheme("light");

    const state = store.getState();
    expect(state.userTheme.mode).toBe("light");
    expect(state.userTheme.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("deve alternare tra light e dark", () => {
    const store = createThemeStore();

    store.getState().changeTheme("light");
    expect(store.getState().userTheme.mode).toBe("light");

    store.getState().changeTheme("dark");
    expect(store.getState().userTheme.mode).toBe("dark");

    store.getState().changeTheme("light");
    expect(store.getState().userTheme.mode).toBe("light");
  });

  it("deve gestire il tema default usando il tema di sistema", () => {
    const store = createThemeStore();

    store.getState().changeTheme("default");

    const state = store.getState();
    expect(state.userTheme.mode).toBe("default");
    // Il tema effettivo dipende da getDefaultTheme() (mockato a "light")
    expect(state.userTheme.theme).toBe("light");
  });

  it("deve impostare colorScheme sul root element", () => {
    const store = createThemeStore();

    store.getState().changeTheme("dark");
    const root = document.getElementById("root") as HTMLDivElement;
    expect(root.style.colorScheme).toBe("dark");

    store.getState().changeTheme("light");
    expect(root.style.colorScheme).toBe("light");
  });
});
