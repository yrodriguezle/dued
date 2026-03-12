import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import TextField from "../TextField";

// Wrapper controlled che simula il comportamento Formik:
// onChange aggiorna lo stato → il nuovo value torna come prop
function ControlledWrapper({ initialValue = "", textUpperCase }: { initialValue?: string; textUpperCase?: boolean }) {
  const [value, setValue] = useState(initialValue);
  return (
    <TextField
      name="test"
      value={value}
      textUpperCase={textUpperCase}
      onChange={(_name, val) => setValue(val)}
      label="Test"
    />
  );
}

/**
 * Simula la digitazione di un carattere in un input a una posizione specifica,
 * replicando il comportamento reale del browser:
 * 1. L'utente posiziona il cursore
 * 2. Digita un carattere
 * 3. Il browser aggiorna il value e sposta il cursore dopo il carattere inserito
 * 4. Viene emesso l'evento change
 */
function typeAtPosition(input: HTMLInputElement, char: string, position: number) {
  const currentValue = input.value;
  const newValue = currentValue.slice(0, position) + char + currentValue.slice(position);
  const newCursorPos = position + char.length;

  // Il browser aggiorna il valore nativo dell'input e posiziona il cursore
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  nativeInputValueSetter?.call(input, newValue);
  input.setSelectionRange(newCursorPos, newCursorPos);

  // Emette gli eventi come farebbe il browser
  // React ascolta "input" per gli input di testo
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("TextField - cursor position", () => {
  it("dovrebbe mantenere la posizione del cursore quando si digita nel mezzo del testo (controlled)", () => {
    render(<ControlledWrapper initialValue="ciao" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    expect(input.value).toBe("ciao");

    // Simula: utente posiziona il cursore tra "ci" e "ao", digita "X"
    act(() => {
      typeAtPosition(input, "X", 2);
    });

    // Il valore dovrebbe essere "ciXao"
    expect(input.value).toBe("ciXao");

    // Il cursore dovrebbe essere alla posizione 3 (dopo la X appena digitata), non alla fine (5)
    expect(input.selectionStart).toBe(3);
  });

  it("dovrebbe mantenere la posizione del cursore con textUpperCase attivo", () => {
    render(<ControlledWrapper initialValue="CIAO" textUpperCase />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    expect(input.value).toBe("CIAO");

    // Simula: utente posiziona il cursore alla posizione 2, digita "x" (verrà uppercased)
    act(() => {
      typeAtPosition(input, "x", 2);
    });

    // Dovrebbe essere uppercase
    expect(input.value).toBe("CIXAO");
    // Il cursore dovrebbe restare alla posizione 3
    expect(input.selectionStart).toBe(3);
  });

  it("dovrebbe mantenere la posizione del cursore digitando all'inizio", () => {
    render(<ControlledWrapper initialValue="mondo" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Digita all'inizio
    act(() => {
      typeAtPosition(input, "A", 0);
    });

    expect(input.value).toBe("Amondo");
    expect(input.selectionStart).toBe(1);
  });

  it("dovrebbe funzionare correttamente digitando alla fine", () => {
    render(<ControlledWrapper initialValue="test" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Digita alla fine
    act(() => {
      typeAtPosition(input, "!", 4);
    });

    expect(input.value).toBe("test!");
    expect(input.selectionStart).toBe(5);
  });
});
