import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormikTestWrapper from "../../../../../test/helpers/formikTestWrapper";
import FormikSearchbox from "../FormikSearchbox";
import { SearchboxOptions } from "../../../../../@types/searchbox";

// Mock di useFetchData per evitare dipendenze GraphQL reali
vi.mock("../../../../../graphql/common/useFetchData", () => ({
  default: vi.fn(() => ({ items: [], loading: false })),
}));

// Mock di ContainerGridResults (dipende da AG Grid)
vi.mock("../ContainerGridResults", () => ({
  default: () => <div data-testid="grid-results">Grid Results</div>,
}));

// Mock di SearchboxModal (dipende da AG Grid)
vi.mock("../SearchboxModal", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void; title: string }) =>
    open ? (
      <div data-testid="searchbox-modal">
        <button onClick={onClose}>Chiudi</button>
      </div>
    ) : null,
}));

// Mock di useResizeObserver
vi.mock("../../../../../common/resizer/useResizeObserver", () => ({
  default: () => ({ ref: { current: null }, dimensions: { width: 600, height: 400 } }),
}));

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

describe("FormikSearchbox", () => {
  const mockOnSelectItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe renderizzare con il valore iniziale di Formik", () => {
    render(
      <FormikTestWrapper initialValues={{ fornitore: "Fornitore A" }}>
        <FormikSearchbox
          name="fornitore"
          label="Fornitore"
          options={testOptions}
          onSelectItem={mockOnSelectItem}
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("Fornitore A");
  });

  it("dovrebbe aggiornare il valore dell'input quando si digita", async () => {
    const user = userEvent.setup();

    render(
      <FormikTestWrapper initialValues={{ fornitore: "" }}>
        <FormikSearchbox
          name="fornitore"
          label="Fornitore"
          options={testOptions}
          onSelectItem={mockOnSelectItem}
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.type(input, "Test");

    expect(input).toHaveValue("Test");
  });

  it("dovrebbe essere disabilitato quando la prop disabled e' true", () => {
    render(
      <FormikTestWrapper initialValues={{ fornitore: "" }}>
        <FormikSearchbox
          name="fornitore"
          label="Fornitore"
          options={testOptions}
          onSelectItem={mockOnSelectItem}
          disabled
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("dovrebbe mostrare errori di validazione dopo il blur", async () => {
    const user = userEvent.setup();
    const { z } = await import("zod");
    const schema = z.object({
      fornitore: z.string().min(1, "Fornitore obbligatorio"),
    });

    render(
      <FormikTestWrapper
        initialValues={{ fornitore: "" }}
        validationSchema={schema}
      >
        <FormikSearchbox
          name="fornitore"
          label="Fornitore"
          options={testOptions}
          onSelectItem={mockOnSelectItem}
        />
      </FormikTestWrapper>
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText("Fornitore obbligatorio")).toBeInTheDocument();
    });
  });

  // Nota: il test di selezione da dropdown richiede AG Grid reale (ContainerGridResults)
  // che e' mockato in questo test suite. Il test verifica solo il rendering e l'input.
  it("dovrebbe aprire il modal quando si clicca il pulsante expand", async () => {
    const user = userEvent.setup();

    render(
      <FormikTestWrapper initialValues={{ fornitore: "" }}>
        <FormikSearchbox
          name="fornitore"
          label="Fornitore"
          options={testOptions}
          onSelectItem={mockOnSelectItem}
        />
      </FormikTestWrapper>
    );

    // Il pulsante di expand modale
    const expandButton = screen.getByRole("button");
    await user.click(expandButton);

    await waitFor(() => {
      expect(screen.getByTestId("searchbox-modal")).toBeInTheDocument();
    });
  });
});
