import { themeQuartz, colorSchemeDark, colorSchemeLight } from "ag-grid-community";

const datagridTheme = themeQuartz.withParams({
  wrapperBorderRadius: "0 0 4px 4px",
  headerHeight: "38px",
  rowHeight: "36px",
});

export const themeLight = datagridTheme.withPart(colorSchemeLight);
export const themeDark = datagridTheme.withPart(colorSchemeDark);
