import { ReactNode } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import { ColoreProdotto } from "./coloriProdotto";

interface TesseraProdottoProps {
  /** L'etichetta grande: il nome del prodotto, o quello del gruppo. */
  nome: string;
  /** La riga sotto: il prezzo, o «da X €» per un gruppo di varianti che costano diverso. */
  dettaglio: string;
  colore: ColoreProdotto;
  /** Contrassegno in alto a destra, usato dal tastone di gruppo per dire quante varianti ha. */
  indicatore?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Un pulsante della griglia del punto vendita: un prodotto da battere, o un gruppo da aprire.
 *
 * <p>🔴 <b>Perché è un componente e non due copie dello stesso JSX.</b> La stessa tessera compare
 * in tre posti — la griglia principale, le varianti dentro un gruppo, i prodotti sciolti — e ciò
 * che la rende usabile al banco sta tutto in dettagli che è facile far divergere copiandoli: i
 * <b>72 px</b> di altezza (molto sopra i 48 minimi, perché si preme al volo e di sbieco), la
 * banda satura nel padding sinistro, la deformazione al tocco invece dell'hover. Se le varianti
 * dentro un gruppo fossero pulsanti «quasi uguali», la differenza si pagherebbe proprio dove il
 * gesto è più veloce.</p>
 *
 * <p>⚠️ <b>Deformazione e non schiarita al tocco</b>: sul telefono l'hover non esiste, e
 * schiarire uno sfondo già tenue non si vedrebbe. Chi ha chiesto meno movimento al sistema
 * operativo non ne vede nessuno.</p>
 */
function TesseraProdotto({ nome, dettaglio, colore, indicatore, disabled, onClick }: TesseraProdottoProps) {
  const { palette } = useTheme();

  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        // ⚠️ 72 px: molto sopra i 48 minimi. Si preme al volo, di sbieco, senza guardare.
        minHeight: 72,
        p: 1,
        // La banda vive nel padding sinistro: 6 px di fascia più il respiro del testo.
        pl: 1.75,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: colore.sfondo,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        textAlign: "left",
        transition: "transform 80ms ease-out, filter 80ms ease-out",
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          bgcolor: colore.banda,
        },
        "&:active": { transform: "scale(0.97)" },
        "&:hover": { filter: palette.mode === "light" ? "brightness(0.96)" : "brightness(1.12)" },
        "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:active": { transform: "none" } },
      }}
    >
      {indicatore}

      <Typography
        variant="body2"
        sx={{ fontWeight: 600, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {nome}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {dettaglio}
      </Typography>
    </ButtonBase>
  );
}

export default TesseraProdotto;
