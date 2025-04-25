import React, { useEffect } from "react";
import Box from "@mui/material/Box";

import useStore from "../../../store/useStore";
import { themeDark, themeLight } from "./datagridThemes";

interface Cache {
  _paramsCssCache: string;
  _cssClassCache: string;
}

const DatagridToolbar: React.FC = () => {
  const { userTheme } = useStore((store) => store);
  const theme = (userTheme.mode === "light" ? themeLight : themeDark) as unknown as Cache;

  const styleId = "datagrid-toolbar-vars-style";
  const wrapperClass = `datagrid-toolbar-vars ${theme._cssClassCache}`;

  useEffect(() => {
    setTimeout(() => {
      const match = theme._paramsCssCache?.match(/\{([\s\S]*)\}/);
      const declarations = match ? match[1].trim() : "";

      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `.${"datagrid-toolbar-vars"} { ${declarations} }`;
    }, 0);
  }, [theme]);

  return (
    <Box className={wrapperClass}>
      <Box
        className="ag-header"
        sx={{
          height: 38,
          border: "var(--ag-header-row-border)",
          borderBottom: "unset",
          borderRadius: "4px 4px 0 0"
        }}
      >
        DatagridToolbar
      </Box>
    </Box>
  );
};

export default DatagridToolbar;
