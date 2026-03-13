import { describe, it, expect, vi } from "vitest";

// Mock delle dipendenze
vi.mock("../../../components/layout/sideBar/getLazyIcon", () => ({
  default: vi.fn((iconName: string) => `icon-${iconName}`),
}));

vi.mock("../../navigator/navigator", () => ({
  navigateTo: vi.fn(),
}));

import createDataTree from "../createDataTree";

describe("createDataTree", () => {
  const createMenu = (overrides: Partial<Menu> = {}): Menu => ({
    __typename: "Menu",
    id: 1,
    menuPadreId: null,
    titolo: "Menu Test",
    percorso: "/test",
    icona: "Home",
    visibile: true,
    posizione: 1,
    ...overrides,
  });

  it("dovrebbe costruire un albero dai menu radice (senza menuPadreId)", () => {
    const menus: Menu[] = [
      createMenu({ id: 1, titolo: "Dashboard", percorso: "/dashboard", posizione: 1 }),
      createMenu({ id: 2, titolo: "Impostazioni", percorso: "/settings", posizione: 2 }),
    ];

    const tree = createDataTree(menus);

    expect(tree).toHaveLength(2);
    expect(tree[0].label).toBe("Dashboard");
    expect(tree[1].label).toBe("Impostazioni");
  });

  it("dovrebbe annidare i figli sotto il menu padre corretto", () => {
    const menus: Menu[] = [
      createMenu({ id: 1, titolo: "Gestione", percorso: "", posizione: 1 }),
      createMenu({ id: 2, menuPadreId: 1, titolo: "Utenti", percorso: "/utenti", posizione: 1 }),
      createMenu({ id: 3, menuPadreId: 1, titolo: "Ruoli", percorso: "/ruoli", posizione: 2 }),
    ];

    const tree = createDataTree(menus);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].label).toBe("Utenti");
    expect(tree[0].children![1].label).toBe("Ruoli");
  });

  it("dovrebbe ordinare i menu per posizione", () => {
    const menus: Menu[] = [
      createMenu({ id: 1, titolo: "Terzo", percorso: "/terzo", posizione: 3 }),
      createMenu({ id: 2, titolo: "Primo", percorso: "/primo", posizione: 1 }),
      createMenu({ id: 3, titolo: "Secondo", percorso: "/secondo", posizione: 2 }),
    ];

    const tree = createDataTree(menus);

    expect(tree[0].label).toBe("Primo");
    expect(tree[1].label).toBe("Secondo");
    expect(tree[2].label).toBe("Terzo");
  });

  it("dovrebbe restituire un array vuoto per un dataset vuoto", () => {
    const tree = createDataTree([]);
    expect(tree).toEqual([]);
  });

  it("dovrebbe impostare onClick solo per i menu con percorso", () => {
    const menus: Menu[] = [
      createMenu({ id: 1, titolo: "Con percorso", percorso: "/dashboard", posizione: 1 }),
      createMenu({ id: 2, titolo: "Senza percorso", percorso: "", posizione: 2 }),
    ];

    const tree = createDataTree(menus);

    expect(tree[0].onClick).toBeDefined();
    expect(tree[1].onClick).toBeUndefined();
  });
});
