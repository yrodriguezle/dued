import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha, useTheme, type Theme } from "@mui/material/styles";

import type { DiagramTone } from "./DiagramPrimitives";

/**
 * Legenda dei diagrammi: spiega cosa significa il colore di un riquadro.
 * Sta in HTML e non dentro l'SVG, così va a capo da sola sugli schermi stretti.
 */

interface VoceLegenda {
  tone: DiagramTone;
  testo: string;
}

interface DiagramLegendProps {
  voci: VoceLegenda[];
}

function coloreTono(theme: Theme, tone: DiagramTone): { bordo: string; sfondo: string } {
  const mappa: Record<DiagramTone, string> = {
    root: theme.palette.primary.main,
    entity: theme.palette.divider,
    derived: theme.palette.success.main,
    join: theme.palette.warning.main,
    service: theme.palette.info.main,
    external: theme.palette.text.disabled,
  };
  const colore = mappa[tone];
  return {
    bordo: colore,
    sfondo: tone === "entity" ? theme.palette.background.paper : alpha(colore, theme.palette.mode === "dark" ? 0.2 : 0.1),
  };
}

function DiagramLegend({ voci }: DiagramLegendProps) {
  const theme = useTheme();

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1 }}>
      {voci.map((voce) => {
        const { bordo, sfondo } = coloreTono(theme, voce.tone);
        return (
          <Box
            key={voce.testo}
            sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
          >
            <Box
              aria-hidden
              sx={{
                width: 18,
                height: 12,
                borderRadius: "3px",
                border: `1.5px solid ${bordo}`,
                backgroundColor: sfondo,
                flexShrink: 0,
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
            >
              {voce.testo}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default DiagramLegend;
