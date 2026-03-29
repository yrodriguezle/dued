import { ColDef } from "ag-grid-community";
import { ReactNode } from "react";

type ColumnAction = "update" | "remove";

// Export for use in searchboxOptions files
export interface SearchboxColDef<T extends Record<string, unknown>> extends ColDef<T> {
  graphField?: string;
  action?: ColumnAction;
}

interface SearchboxOptions<T extends Record<string, unknown>> {
  query: string;
  id: Extract<keyof T, string>;
  tableName: string;
  additionalWhere?: string;
  view?: string;
  items: SearchboxColDef<T>[];
  modal: {
    title: string;
    fragment?: string;
    items: SearchboxColDef<T>[];
  };
  renderCreateForm?: (props: { onSaved: (item: T) => void; onCancel: () => void }) => ReactNode;
}
