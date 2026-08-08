import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { CustomCellEditorProps } from "ag-grid-react";
import DateCellEditor from "../cellEditors/date/DateCellEditor";
import toDateInputValue from "../cellEditors/date/toDateInputValue";

function renderEditor(overrides: Partial<CustomCellEditorProps> = {}) {
  const onValueChange = vi.fn();
  const props = {
    value: "2026-06-30",
    onValueChange,
    stopEditing: vi.fn(),
    eventKey: null,
  } as unknown as CustomCellEditorProps;

  render(
    <DateCellEditor
      {...props}
      {...overrides}
    />
  );
  const input = screen.getByDisplayValue(/2026-06-30|^$/) as HTMLInputElement;
  return { input, onValueChange };
}

describe("toDateInputValue", () => {
  it("spoglia la componente oraria richiesta dall'input nativo", () => {
    expect(toDateInputValue("2026-06-30T00:00:00")).toBe("2026-06-30");
  });

  it("lascia intatta una data gia pulita", () => {
    expect(toDateInputValue("2026-06-30")).toBe("2026-06-30");
  });

  it("degrada a stringa vuota su valori assenti o non stringa", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue(42)).toBe("");
  });
});

describe("DateCellEditor", () => {
  it("prende il focus sull'input, non sul contenitore della cella", () => {
    vi.useFakeTimers();
    const { input } = renderEditor();

    // Il focus viene rivendicato dopo che AG Grid ha spostato il suo.
    act(() => {
      vi.runAllTimers();
    });

    expect(document.activeElement).toBe(input);
    vi.useRealTimers();
  });

  it("annulla l'azione di default del Tab per non camminare fra i segmenti", () => {
    const { input } = renderEditor();

    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    input.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(true);
  });

  it("lascia risalire il Tab, perche lo spostamento di cella lo fa AG Grid", () => {
    const onParentKeyDown = vi.fn();
    const onValueChange = vi.fn();
    const props = { value: "2026-06-30", onValueChange, stopEditing: vi.fn(), eventKey: null } as unknown as CustomCellEditorProps;

    render(
      <div onKeyDown={onParentKeyDown}>
        <DateCellEditor {...props} />
      </div>
    );
    const input = screen.getByDisplayValue("2026-06-30");

    fireEvent.keyDown(input, { key: "Tab" });

    expect(onParentKeyDown).toHaveBeenCalledTimes(1);
  });

  it("non interferisce con gli altri tasti", () => {
    const { input } = renderEditor();

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    input.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
  });

  it("propaga il nuovo valore alla griglia", () => {
    const { input, onValueChange } = renderEditor();

    fireEvent.change(input, { target: { value: "2026-07-15" } });

    expect(onValueChange).toHaveBeenCalledWith("2026-07-15");
  });

  it("normalizza un valore ISO completo in arrivo dal server", () => {
    const { input } = renderEditor({ value: "2026-06-30T00:00:00" } as Partial<CustomCellEditorProps>);

    expect(input.value).toBe("2026-06-30");
  });
});
