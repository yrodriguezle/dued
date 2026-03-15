import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Searchbox from "../Searchbox";
import { SearchboxOptions } from "../../../../../@types/searchbox";

// ─── Mock di useFetchData ────────────────────────────────────────────────────
const mockUseFetchData = vi.fn();
vi.mock("../../../../../graphql/common/useFetchData", () => ({
  default: (...args: unknown[]) => mockUseFetchData(...args),
}));

// ─── Mock di useSearchboxQueryParams ────────────────────────────────────────
vi.mock("../useSearchboxQueryParams", () => ({
  default: () => ({ query: {}, variables: {} }),
}));

// ─── Mock di ContainerGridResults (dipende da AG Grid) ───────────────────────
vi.mock("../ContainerGridResults", () => ({
  default: ({ onSelectedItem }: { onSelectedItem: (item: Record<string, unknown>) => void }) => (
    <div data-testid="grid-results">
      <button
        onClick={() => onSelectedItem({ id: 1, nome: "Mario Rossi" })}
        data-testid="select-item-btn"
      >
        Mario Rossi
      </button>
    </div>
  ),
}));

// ─── Mock di SearchboxModal (dipende da AG Grid) ─────────────────────────────
vi.mock("../SearchboxModal", () => ({
  default: ({
    open,
    onClose,
    onSelectItem,
  }: {
    open: boolean;
    onClose: () => void;
    onSelectItem: (item: Record<string, unknown>) => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="searchbox-modal">
        <button
          onClick={() => onSelectItem({ id: 2, nome: "Luigi Verdi" })}
          data-testid="modal-select-btn"
        >
          Seleziona Luigi Verdi
        </button>
        <button
          onClick={onClose}
          data-testid="modal-close-btn"
        >
          Chiudi
        </button>
      </div>
    ) : null,
}));

// ─── Tipo e opzioni di test ────────────────────────────────────────────────
type TestItem = Record<string, unknown> & { id: number; nome: string };

const testOptions: SearchboxOptions<TestItem> = {
  query: "testQuery",
  id: "id",
  tableName: "test",
  items: [{ field: "nome", headerName: "Nome" }],
  modal: {
    title: "Seleziona elemento",
    items: [{ field: "nome", headerName: "Nome" }],
  },
};

// ─── Helper di render ──────────────────────────────────────────────────────
interface RenderSearchboxOptions {
  value?: string;
  disabled?: boolean;
  loading?: boolean;
  items?: TestItem[];
  onSelectItem?: Mock;
  onChange?: Mock;
}

function renderSearchbox({
  value = "",
  disabled = false,
  loading = false,
  items = [],
  onSelectItem = vi.fn(),
  onChange = vi.fn(),
}: RenderSearchboxOptions = {}) {
  mockUseFetchData.mockReturnValue({ items, loading });

  return render(
    <Searchbox<TestItem>
      name="nome"
      value={value}
      options={testOptions}
      onSelectItem={onSelectItem}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Searchbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchData.mockReturnValue({ items: [], loading: false });
  });

  // ─── REQ-SB-009: Sincronizzazione valore ──────────────────────────────────

  describe("REQ-SB-009 - Sincronizzazione valore", () => {
    it("dovrebbe mostrare il valore iniziale nel TextField", () => {
      renderSearchbox({ value: "Fornitore A" });
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("Fornitore A");
    });

    it("dovrebbe aggiornare il valore interno quando la prop value esterna cambia", async () => {
      const { rerender } = render(
        <Searchbox<TestItem>
          name="nome"
          value="Mario"
          options={testOptions}
          onSelectItem={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("Mario");

      rerender(
        <Searchbox<TestItem>
          name="nome"
          value="Luigi"
          options={testOptions}
          onSelectItem={vi.fn()}
        />
      );

      expect(input).toHaveValue("Luigi");
    });

    it("dovrebbe azzerare il valore quando la prop value diventa stringa vuota", async () => {
      const { rerender } = render(
        <Searchbox<TestItem>
          name="nome"
          value="Mario"
          options={testOptions}
          onSelectItem={vi.fn()}
        />
      );

      rerender(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("");
    });

    it("dovrebbe aggiornare il valore dell'input durante la digitazione", async () => {
      const user = userEvent.setup();
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      await user.type(input, "Test");

      expect(input).toHaveValue("Test");
    });
  });

  // ─── REQ-SB-004: Visibilità dropdown ──────────────────────────────────────

  describe("REQ-SB-004 - Visibilità dropdown risultati", () => {
    it("dovrebbe mostrare il dropdown quando si digita testo non vuoto (1 carattere)", async () => {
      const user = userEvent.setup();
      // Con 1 carattere il componente non soddisfa la condizione > 2 per mostrare
      // "Nessun risultato trovato", quindi usa ContainerGridResults anche con items vuoti
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });
    });

    it("dovrebbe mostrare il dropdown con items presenti (più di 2 caratteri)", async () => {
      const user = userEvent.setup();
      // Imposta il mock PRIMA di fare render per non essere sovrascritto da renderSearchbox
      mockUseFetchData.mockReturnValue({
        items: [{ id: 1, nome: "Mario Rossi" }],
        loading: false,
      });

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={vi.fn()}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "Mar");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });
    });

    it("dovrebbe nascondere il dropdown quando si cancella tutto il testo", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      // Uso 1 carattere per vedere il dropdown (ContainerGridResults)
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      await user.clear(input);

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
      });
    });

    it("non dovrebbe mostrare il dropdown con valore iniziale vuoto senza digitazione", () => {
      renderSearchbox({ value: "" });
      expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
    });
  });

  // ─── REQ-SB-005: Messaggio "Nessun risultato trovato" ─────────────────────

  describe("REQ-SB-005 - Messaggio Nessun risultato trovato", () => {
    it("dovrebbe mostrare il messaggio con input > 2 caratteri e 0 risultati", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });

      renderSearchbox({ value: "", items: [], loading: false });

      const input = screen.getByRole("textbox");
      await user.type(input, "xyz");

      await waitFor(() => {
        expect(screen.getByText("Nessun risultato trovato")).toBeInTheDocument();
      });
    });

    it("NON dovrebbe mostrare il messaggio con input <= 2 caratteri", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });

      renderSearchbox({ value: "", items: [], loading: false });

      const input = screen.getByRole("textbox");
      await user.type(input, "xy");

      // Il dropdown è visibile ma il messaggio non deve esserci
      await waitFor(() => {
        expect(screen.queryByText("Nessun risultato trovato")).not.toBeInTheDocument();
      });
    });

    it("NON dovrebbe mostrare il messaggio durante il loading", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: true });

      renderSearchbox({ value: "", items: [], loading: true });

      const input = screen.getByRole("textbox");
      await user.type(input, "xyz123");

      await waitFor(() => {
        expect(screen.queryByText("Nessun risultato trovato")).not.toBeInTheDocument();
      });
    });
  });

  // ─── REQ-SB-006 / REQ-SB-007: Selezione elemento ─────────────────────────

  describe("REQ-SB-006/007 - Selezione elemento dal dropdown", () => {
    it("dovrebbe aggiornare il valore del campo dopo la selezione", async () => {
      const user = userEvent.setup();
      const onSelectItem = vi.fn();
      mockUseFetchData.mockReturnValue({
        items: [{ id: 1, nome: "Mario Rossi" }],
        loading: false,
      });

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={onSelectItem}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "Mar");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      const selectBtn = screen.getByTestId("select-item-btn");
      await user.click(selectBtn);

      await waitFor(() => {
        expect(input).toHaveValue("Mario Rossi");
      });
    });

    it("dovrebbe chiamare onSelectItem con l'elemento corretto", async () => {
      const user = userEvent.setup();
      const onSelectItem = vi.fn();
      mockUseFetchData.mockReturnValue({
        items: [{ id: 1, nome: "Mario Rossi" }],
        loading: false,
      });

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={onSelectItem}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "Mar");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("select-item-btn"));

      expect(onSelectItem).toHaveBeenCalledWith({ id: 1, nome: "Mario Rossi" });
    });

    it("dovrebbe chiudere il dropdown dopo la selezione", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({
        items: [{ id: 1, nome: "Mario Rossi" }],
        loading: false,
      });

      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      // 1 carattere: la griglia è sempre visibile (non scatta "Nessun risultato trovato")
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("select-item-btn"));

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
      });
    });
  });

  // ─── REQ-SB-007: Navigazione tastiera ────────────────────────────────────

  describe("REQ-SB-007 - Navigazione tastiera", () => {
    it("dovrebbe chiudere il dropdown premendo Escape", async () => {
      const user = userEvent.setup();
      // Uso 1 carattere per evitare la condizione "Nessun risultato trovato" (> 2 car, items vuoti)
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
      });
    });

    it("dovrebbe chiudere il dropdown premendo Tab", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
      });
    });

    it("dovrebbe auto-selezionare con Enter su match esatto case-insensitive", async () => {
      const user = userEvent.setup();
      const onSelectItem = vi.fn();
      mockUseFetchData.mockReturnValue({
        items: [{ id: 1, nome: "mario rossi" }],
        loading: false,
      });

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={onSelectItem}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "Mario Rossi");

      // Forziamo il valore dell'input a corrispondere al nome dell'item
      // tramite fireEvent.change per simulare match esatto
      fireEvent.change(input, { target: { value: "mario rossi" } });

      await user.keyboard("{Enter}");

      expect(onSelectItem).toHaveBeenCalledWith({ id: 1, nome: "mario rossi" });
    });
  });

  // ─── REQ-SB-008: Click esterno chiude il dropdown ────────────────────────

  describe("REQ-SB-008 - Click esterno chiude il dropdown", () => {
    it("dovrebbe chiudere il dropdown cliccando fuori dal componente", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      // 1 carattere: dropdown visibile come griglia (non scatta "Nessun risultato trovato")
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      // Click fuori dal componente
      act(() => {
        fireEvent.mouseDown(document.body);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
      });
    });
  });

  // ─── REQ-SB-010: Modale espansione ───────────────────────────────────────

  describe("REQ-SB-010 - Modale espansione", () => {
    it("dovrebbe aprire la modale cliccando il pulsante expand", async () => {
      const user = userEvent.setup();
      renderSearchbox({ value: "" });

      const expandButton = screen.getByRole("button");
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByTestId("searchbox-modal")).toBeInTheDocument();
      });
    });

    it("dovrebbe chiudere il dropdown quando si apre la modale", async () => {
      const user = userEvent.setup();
      mockUseFetchData.mockReturnValue({ items: [], loading: false });
      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      // 1 carattere: la griglia è visibile (non scatta la condizione "Nessun risultato")
      await user.type(input, "M");

      await waitFor(() => {
        expect(screen.getByTestId("grid-results")).toBeInTheDocument();
      });

      // La griglia mockata ha un pulsante "Mario Rossi", cerchiamo il pulsante expand per data-testid dell'icona
      const expandButton = screen.getByTestId("ExpandMoreIcon").closest("button") as HTMLElement;
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.queryByTestId("grid-results")).not.toBeInTheDocument();
        expect(screen.getByTestId("searchbox-modal")).toBeInTheDocument();
      });
    });

    it("dovrebbe selezionare un elemento dalla modale e chiuderla", async () => {
      const user = userEvent.setup();
      const onSelectItem = vi.fn();

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={onSelectItem}
        />
      );

      const expandButton = screen.getByRole("button");
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByTestId("searchbox-modal")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("modal-select-btn"));

      await waitFor(() => {
        expect(onSelectItem).toHaveBeenCalledWith({ id: 2, nome: "Luigi Verdi" });
        expect(screen.queryByTestId("searchbox-modal")).not.toBeInTheDocument();
      });
    });

    it("dovrebbe aggiornare il campo dopo la selezione dalla modale", async () => {
      const user = userEvent.setup();

      renderSearchbox({ value: "" });

      const input = screen.getByRole("textbox");
      const expandButton = screen.getByRole("button");
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByTestId("searchbox-modal")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("modal-select-btn"));

      await waitFor(() => {
        expect(input).toHaveValue("Luigi Verdi");
      });
    });
  });

  // ─── REQ-SB-011: Indicatore di caricamento ───────────────────────────────

  describe("REQ-SB-011 - Indicatore di caricamento", () => {
    it("dovrebbe mostrare CircularProgress durante il loading", () => {
      mockUseFetchData.mockReturnValue({ items: [], loading: true });

      renderSearchbox({ value: "test", loading: true });

      // CircularProgress appare al posto del pulsante expand
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      // Il spinner è presente nel DOM (ha role="progressbar" in MUI)
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("dovrebbe mostrare il pulsante expand quando il loading è terminato", () => {
      mockUseFetchData.mockReturnValue({ items: [], loading: false });

      renderSearchbox({ value: "test", loading: false });

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  // ─── REQ-SB-012: Stato disabled ──────────────────────────────────────────

  describe("REQ-SB-012 - Stato disabilitato", () => {
    it("dovrebbe disabilitare il campo di testo quando disabled=true", () => {
      renderSearchbox({ disabled: true });
      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("dovrebbe disabilitare il pulsante expand quando disabled=true", () => {
      renderSearchbox({ disabled: true });
      const expandButton = screen.getByRole("button");
      expect(expandButton).toBeDisabled();
    });
  });

  // ─── REQ-SB-013: Callback onChange ───────────────────────────────────────

  describe("Callback onChange", () => {
    it("dovrebbe chiamare onChange con il nome del campo e il nuovo valore", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Searchbox<TestItem>
          name="nome"
          value=""
          options={testOptions}
          onSelectItem={vi.fn()}
          onChange={onChange}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "A");

      expect(onChange).toHaveBeenCalledWith("nome", expect.stringContaining("A"));
    });
  });
});
