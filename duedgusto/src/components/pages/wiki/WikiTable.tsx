import { ReactNode } from "react";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

interface WikiTableProps {
  intestazioni: string[];
  righe: ReactNode[][];
  /** Sotto questa larghezza la tabella scorre in orizzontale invece di spezzare le parole. */
  minWidth?: number;
  "aria-label"?: string;
}

/** Tabella di riferimento della wiki: intestazione fissa, scroll orizzontale su schermi stretti. */
function WikiTable({ intestazioni, righe, minWidth = 640, "aria-label": ariaLabel }: WikiTableProps) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ my: 2 }}
    >
      <Table
        size="small"
        aria-label={ariaLabel}
        sx={{ minWidth }}
      >
        <TableHead>
          <TableRow>
            {intestazioni.map((intestazione) => (
              <TableCell
                key={intestazione}
                sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {intestazione}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {righe.map((riga, indiceRiga) => (
            <TableRow key={indiceRiga}>
              {riga.map((cella, indiceCella) => (
                <TableCell
                  key={indiceCella}
                  sx={{ verticalAlign: "top" }}
                >
                  {cella}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default WikiTable;
