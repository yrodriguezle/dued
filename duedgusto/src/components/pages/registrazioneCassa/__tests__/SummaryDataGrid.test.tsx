import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../../common/datagrid/@types/Datagrid";
import { CashCountRowData } from "../useCashCountData";

// Cattura le props passate al Datagrid
let capturedDatagridProps: Record<string, unknown> = {};

vi.mock("../../../common/datagrid/Datagrid", () => ({
  default: (props: Record<string, unknown>) => {
    capturedDatagridProps = props;
    return <div data-testid="mock-datagrid" />;
  },
}));

// Import DOPO il mock
import SummaryDataGrid from "../SummaryDataGrid";

const theme = createTheme();

function createMockGridRef() {
  return {
    current: {
      api: {
        forEachNode: vi.fn(),
      },
      context: {
        getGridData: vi.fn(() => []),
      },
    },
  } as unknown as React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
}

describe("SummaryDataGrid", () => {
  beforeEach(() => {
    capturedDatagridProps = {};
  });

  it("NON deve passare domLayout='autoHeight' al Datagrid — causa scroll globale", () => {
    const openingGridRef = createMockGridRef();
    const closingGridRef = createMockGridRef();
    const incomesGridRef = createMockGridRef();
    const expensesGridRef = createMockGridRef();

    render(
      <ThemeProvider theme={theme}>
        <SummaryDataGrid
          openingGridRef={openingGridRef}
          closingGridRef={closingGridRef}
          incomesGridRef={incomesGridRef as never}
          expensesGridRef={expensesGridRef as never}
          refreshKey={0}
        />
      </ThemeProvider>
    );

    // Il bug: domLayout="autoHeight" ignora height="400px" e fa espandere AG Grid
    // causando uno scroll globale che rompe la UI del registro cassa
    expect(capturedDatagridProps.domLayout).not.toBe("autoHeight");
  });

  it("deve avere un'altezza fissa di 400px", () => {
    const openingGridRef = createMockGridRef();
    const closingGridRef = createMockGridRef();
    const incomesGridRef = createMockGridRef();
    const expensesGridRef = createMockGridRef();

    render(
      <ThemeProvider theme={theme}>
        <SummaryDataGrid
          openingGridRef={openingGridRef}
          closingGridRef={closingGridRef}
          incomesGridRef={incomesGridRef as never}
          expensesGridRef={expensesGridRef as never}
          refreshKey={0}
        />
      </ThemeProvider>
    );

    expect(capturedDatagridProps.height).toBe("400px");
  });

  it("deve essere in modalità presentation (read-only)", () => {
    const openingGridRef = createMockGridRef();
    const closingGridRef = createMockGridRef();
    const incomesGridRef = createMockGridRef();
    const expensesGridRef = createMockGridRef();

    render(
      <ThemeProvider theme={theme}>
        <SummaryDataGrid
          openingGridRef={openingGridRef}
          closingGridRef={closingGridRef}
          incomesGridRef={incomesGridRef as never}
          expensesGridRef={expensesGridRef as never}
          refreshKey={0}
        />
      </ThemeProvider>
    );

    expect(capturedDatagridProps.presentation).toBe(true);
  });
});
