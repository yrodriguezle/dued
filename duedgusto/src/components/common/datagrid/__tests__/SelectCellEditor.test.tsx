import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { CustomCellEditorProps } from "ag-grid-react";
import SelectCellEditor from "../cellEditors/select/SelectCellEditor";

const CATEGORIE = ["Affitto", "Utenze", "Stipendi", "Altro"];

function renderEditor(overrides: Record<string, unknown> = {}) {
  const onValueChange = vi.fn();
  const stopEditing = vi.fn();
  const props = {
    value: "Utenze",
    values: CATEGORIE,
    onValueChange,
    stopEditing,
  } as unknown as CustomCellEditorProps;

  render(
    <SelectCellEditor
      {...props}
      {...overrides}
    />
  );
  return { select: screen.getByRole("combobox") as HTMLSelectElement, onValueChange, stopEditing };
}

describe("SelectCellEditor", () => {
  it("mostra le opzioni ricevute da cellEditorParams.values", () => {
    renderEditor();

    CATEGORIE.forEach((categoria) => {
      expect(screen.getByRole("option", { name: categoria })).toBeInTheDocument();
    });
  });

  it("parte dal valore corrente della cella", () => {
    const { select } = renderEditor();

    expect(select.value).toBe("Utenze");
  });

  it("prende il focus dopo il mount", () => {
    vi.useFakeTimers();
    const { select } = renderEditor();

    act(() => {
      vi.runAllTimers();
    });

    expect(document.activeElement).toBe(select);
    vi.useRealTimers();
  });

  it("propaga la voce scelta alla griglia", () => {
    const { select, onValueChange } = renderEditor();

    fireEvent.change(select, { target: { value: "Stipendi" } });

    expect(onValueChange).toHaveBeenCalledWith("Stipendi");
  });

  it("NON chiude l'editing dopo la selezione: e cio che fa aprire in editing la cella successiva col Tab", () => {
    const { select, stopEditing } = renderEditor();

    fireEvent.change(select, { target: { value: "Stipendi" } });

    expect(stopEditing).not.toHaveBeenCalled();
  });

  it("non intercetta il Tab: lo spostamento di cella resta ad AG Grid", () => {
    const { select } = renderEditor();

    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    select.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(false);
  });

  it("non fa sparire un valore storico fuori elenco", () => {
    const { select } = renderEditor({ value: "CategoriaDismessa" });

    expect(select.value).toBe("CategoriaDismessa");
    expect(screen.getByRole("option", { name: "CategoriaDismessa" })).toBeInTheDocument();
  });

  it("regge l'assenza di values senza esplodere", () => {
    const { select } = renderEditor({ values: undefined, value: null });

    expect(select.value).toBe("");
  });
});
