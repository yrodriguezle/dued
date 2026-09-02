import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { CellKeyDownEvent } from "ag-grid-community";
import useTabNavigation from "../useTabNavigation";
import useEnterNavigation from "../useEnterNavigation";

interface FakeEventOptions {
  key: string;
  shiftKey?: boolean;
  rowIndex?: number | null;
  colId?: string;
}

function createEvent({ key, shiftKey = false, rowIndex = 2, colId = "importo" }: FakeEventOptions) {
  const keyboardEvent = { key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  const event = {
    event: keyboardEvent,
    node: { rowIndex },
    column: { getColId: () => colId },
  };
  return { event: event as unknown as CellKeyDownEvent, keyboardEvent };
}

describe("useTabNavigation", () => {
  it("delega lo spostamento e annulla il Tab nativo quando lo prende in carico", () => {
    const navigateFromCell = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useTabNavigation({ navigateFromCell }));
    const { event, keyboardEvent } = createEvent({ key: "Tab" });

    result.current.handleCellKeyDown(event);

    expect(navigateFromCell).toHaveBeenCalledWith(2, "importo", { fromKeyboard: true });
    expect(keyboardEvent.preventDefault).toHaveBeenCalled();
  });

  it("lascia il Tab ad AG Grid quando lo spostamento non è stato preso in carico", () => {
    const navigateFromCell = vi.fn().mockReturnValue(false);
    const { result } = renderHook(() => useTabNavigation({ navigateFromCell }));
    const { event, keyboardEvent } = createEvent({ key: "Tab" });

    result.current.handleCellKeyDown(event);

    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("ignora Shift+Tab e gli altri tasti", () => {
    const navigateFromCell = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useTabNavigation({ navigateFromCell }));

    result.current.handleCellKeyDown(createEvent({ key: "Tab", shiftKey: true }).event);
    result.current.handleCellKeyDown(createEvent({ key: "a" }).event);

    expect(navigateFromCell).not.toHaveBeenCalled();
  });
});

describe("useEnterNavigation", () => {
  it("su mobile l'Invio avanza come il Tab", () => {
    const navigateFromCell = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useEnterNavigation({ isMobile: true, navigateFromCell }));
    const { event, keyboardEvent } = createEvent({ key: "Enter" });

    result.current.handleEnterNavigation(event);

    expect(navigateFromCell).toHaveBeenCalledWith(2, "importo", { fromKeyboard: false });
    expect(keyboardEvent.preventDefault).toHaveBeenCalled();
  });

  it("su desktop l'Invio resta ad AG Grid", () => {
    const navigateFromCell = vi.fn();
    const { result } = renderHook(() => useEnterNavigation({ isMobile: false, navigateFromCell }));

    result.current.handleEnterNavigation(createEvent({ key: "Enter" }).event);

    expect(navigateFromCell).not.toHaveBeenCalled();
  });

  it("ignora le righe senza indice", () => {
    const navigateFromCell = vi.fn();
    const { result } = renderHook(() => useEnterNavigation({ isMobile: true, navigateFromCell }));

    result.current.handleEnterNavigation(createEvent({ key: "Enter", rowIndex: null }).event);

    expect(navigateFromCell).not.toHaveBeenCalled();
  });
});
