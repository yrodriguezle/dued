import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import setInitialFocus from "../setInitialFocus";

describe("setInitialFocus (registrazione cassa)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<input type="text" /><input type="number" />';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("mette il focus sul primo campo numerico dopo il ritardo", () => {
    const campoNumerico = document.querySelector<HTMLInputElement>('input[type="number"]');

    setInitialFocus();
    vi.advanceTimersByTime(100);

    expect(document.activeElement).toBe(campoNumerico);
  });

  it("non tocca il focus prima che il ritardo sia trascorso", () => {
    setInitialFocus();
    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(document.body);
  });

  it("la funzione di annullamento impedisce al timer di scattare", () => {
    const annulla = setInitialFocus();
    annulla();
    vi.advanceTimersByTime(100);

    // Il timer non deve sopravvivere allo smontaggio: fuori dai test ruberebbe il focus
    // alla pagina successiva, nei test scatta a jsdom gia smontato ("document is not defined").
    expect(document.activeElement).toBe(document.body);
    expect(vi.getTimerCount()).toBe(0);
  });
});
