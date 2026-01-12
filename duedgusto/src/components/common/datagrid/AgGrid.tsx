import { JSX, ForwardedRef, forwardRef } from "react";
import { AgGridReact, AgGridReactProps } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { SetFilterModule, MultiFilterModule, RichSelectModule, TreeDataModule } from "ag-grid-enterprise";

import { AG_GRID_LOCALE_IT } from "./i18n/it-IT";
import useStore from "../../../store/useStore";
import { themeDark, themeLight } from "./datagridThemes";
import { DatagridData } from "./@types/Datagrid";

ModuleRegistry.registerModules([AllCommunityModule, SetFilterModule, MultiFilterModule, RichSelectModule, TreeDataModule]);

function AgGridInner<T extends Record<string, unknown>>(agGridProps: AgGridReactProps<DatagridData<T>>, ref: ForwardedRef<AgGridReact<DatagridData<T>>>) {
  const { userTheme } = useStore((store) => store);
  return (
    <AgGridReact<DatagridData<T>>
      localeText={AG_GRID_LOCALE_IT}
      theme={userTheme.mode === "light" ? themeLight : themeDark}
      stopEditingWhenCellsLoseFocus={true}
      ref={ref}
      {...agGridProps}
    />
  );
}

const AgGrid = forwardRef(AgGridInner) as <T extends Record<string, unknown>>(props: AgGridReactProps<DatagridData<T>> & { ref?: ForwardedRef<AgGridReact<DatagridData<T>>> }) => JSX.Element;

export default AgGrid;
