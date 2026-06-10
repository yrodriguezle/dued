import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCrudForm from "../useCrudForm";

interface TestFormValues {
  id?: number;
  nome: string;
  paese: string;
  attivo: boolean;
  aliquota: number;
}

const getDefaults = (): TestFormValues => ({
  id: undefined,
  nome: "",
  paese: "IT",
  attivo: true,
  aliquota: 22,
});

function appendNamedInput(name: string) {
  const input = document.createElement("input");
  input.setAttribute("name", name);
  document.body.appendChild(input);
  return input;
}

describe("useCrudForm", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("inizializza con i valori di default della factory", () => {
    const { result } = renderHook(() => useCrudForm<TestFormValues>({ defaultValues: getDefaults }));

    expect(result.current.initialValues).toEqual(getDefaults());
  });

  it("imposta il focus iniziale sul campo focusFieldName al mount", () => {
    const input = appendNamedInput("nome");

    renderHook(() =>
      useCrudForm<TestFormValues>({
        defaultValues: getDefaults,
        focusFieldName: "nome",
      })
    );

    expect(document.activeElement).toBe(input);
  });

  it("non imposta il focus quando skipInitialize è true", () => {
    const input = appendNamedInput("nome");

    renderHook(() =>
      useCrudForm<TestFormValues>({
        defaultValues: getDefaults,
        skipInitialize: true,
        focusFieldName: "nome",
      })
    );

    expect(document.activeElement).not.toBe(input);
  });

  it("non lancia se il campo di focus non esiste nel DOM o non è configurato", () => {
    expect(() =>
      renderHook(() =>
        useCrudForm<TestFormValues>({
          defaultValues: getDefaults,
          focusFieldName: "campoInesistente",
        })
      )
    ).not.toThrow();

    expect(() => renderHook(() => useCrudForm<TestFormValues>({ defaultValues: getDefaults }))).not.toThrow();
  });

  it("fonde i valori parziali con i default (i campi assenti restano ai default)", async () => {
    const { result } = renderHook(() => useCrudForm<TestFormValues>({ defaultValues: getDefaults }));

    await act(async () => {
      await result.current.handleInitializeValues({ id: 7, nome: "ACME srl" });
    });

    expect(result.current.initialValues).toEqual({
      id: 7,
      nome: "ACME srl",
      paese: "IT",
      attivo: true,
      aliquota: 22,
    });
  });

  it("non forza il focus quando vengono passati valori (caricamento entità esistente)", async () => {
    const input = appendNamedInput("nome");
    const { result } = renderHook(() =>
      useCrudForm<TestFormValues>({
        defaultValues: getDefaults,
        skipInitialize: true,
        focusFieldName: "nome",
      })
    );

    await act(async () => {
      await result.current.handleInitializeValues({ nome: "Esistente" });
    });

    expect(document.activeElement).not.toBe(input);
    expect(result.current.initialValues.nome).toBe("Esistente");
  });

  it("esegue l'inizializzazione una sola volta (nessun reset sui re-render)", async () => {
    const { result, rerender } = renderHook(() => useCrudForm<TestFormValues>({ defaultValues: getDefaults }));

    await act(async () => {
      await result.current.handleInitializeValues({ nome: "Digitato" });
    });

    rerender();

    expect(result.current.initialValues.nome).toBe("Digitato");
  });

  it("setInitialFocus mette il focus a richiesta (reset post-conferma)", () => {
    const input = appendNamedInput("nome");
    const { result } = renderHook(() =>
      useCrudForm<TestFormValues>({
        defaultValues: getDefaults,
        skipInitialize: true,
        focusFieldName: "nome",
      })
    );

    expect(document.activeElement).not.toBe(input);

    act(() => {
      result.current.setInitialFocus();
    });

    expect(document.activeElement).toBe(input);
  });
});
