import { ReactNode } from "react";
import Box from "@mui/material/Box";

interface WikiCodeProps {
  children: ReactNode;
  /** Blocco a tutta larghezza invece di frammento in linea. */
  blocco?: boolean;
}

/** Nome di classe, campo o formula reso in monospazio. */
function WikiCode({ children, blocco = false }: WikiCodeProps) {
  return (
    <Box
      component="code"
      sx={(theme) => ({
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        fontSize: "0.82rem",
        backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: "4px",
        px: 0.75,
        py: blocco ? 1 : 0.25,
        display: blocco ? "block" : "inline",
        overflowX: blocco ? "auto" : undefined,
        whiteSpace: blocco ? "pre" : "nowrap",
      })}
    >
      {children}
    </Box>
  );
}

export default WikiCode;
