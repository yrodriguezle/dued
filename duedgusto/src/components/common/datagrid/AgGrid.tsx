import { JSX, ForwardedRef, forwardRef } from "react";
import { AgGridReact, AgGridReactProps } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
} from 'ag-grid-community';
import {
  SetFilterModule,
  MultiFilterModule,
  RichSelectModule,
  TreeDataModule,
} from 'ag-grid-enterprise';

import { AG_GRID_LOCALE_IT } from "./i18n/it-IT";
import useStore from "../../../store/useStore";
import { themeDark, themeLight } from "./datagridThemes";

ModuleRegistry.registerModules([
  AllCommunityModule,
  SetFilterModule,
  MultiFilterModule,
  RichSelectModule,
  TreeDataModule,
]);

function AgGridInner<TData>(agGridProps: AgGridReactProps<TData>, ref: ForwardedRef<AgGridReact<TData>>) {
  const { userTheme } = useStore((store) => store);
  return (
    <AgGridReact<TData>
      localeText={AG_GRID_LOCALE_IT}
      theme={userTheme.mode === "light" ? themeLight : themeDark}
      ref={ref}
      {...agGridProps}
    />
  );
}

const AgGrid = forwardRef(AgGridInner) as <TData>(props: AgGridReactProps<TData> & { ref?: ForwardedRef<AgGridReact<TData>> }) => JSX.Element;

export default AgGrid;
