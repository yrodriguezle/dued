import { useMemo } from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import formatCurrency from "../../../../common/bones/formatCurrency";
import useChartPalette, { ChartPalette } from "./useChartPalette";
import { clampaFlussoCassa, costruisciFlussoSankey, ChiaveColoreFlusso, NodoFlussoSankey } from "./flussoCassaUtils";

const ALTEZZA_GRAFICO = 320;

// Nodi dell'ultima colonna del Sankey: etichetta a sinistra del rettangolo
const COLORI_ULTIMA_COLONNA: ChiaveColoreFlusso[] = ["spese", "netto"];

interface NodoSankeyRenderProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: NodoFlussoSankey & { value?: number };
  palette: ChartPalette;
}

/** Nodo custom: rettangolo con colore semantico della palette + etichetta e valore. */
function NodoSankey({ x = 0, y = 0, width = 0, height = 0, payload, palette }: NodoSankeyRenderProps) {
  if (!payload) return null;
  const colore = palette[payload.colore];
  const etichettaASinistra = COLORI_ULTIMA_COLONNA.includes(payload.colore);
  const labelX = etichettaASinistra ? x - 8 : x + width + 8;
  const textAnchor = etichettaASinistra ? "end" : "start";
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colore}
        fillOpacity={0.9}
      />
      <text
        x={labelX}
        y={y + height / 2 - 2}
        textAnchor={textAnchor}
        fill={palette.tooltip.color}
        fontSize={12}
        fontWeight={600}
      >
        {payload.name}
      </text>
      <text
        x={labelX}
        y={y + height / 2 + 12}
        textAnchor={textAnchor}
        fill={palette.tooltip.color}
        fillOpacity={0.65}
        fontSize={11}
      >
        {`€ ${formatCurrency(payload.value ?? 0)}`}
      </text>
    </Layer>
  );
}

interface LinkSankeyRenderProps {
  sourceX?: number;
  targetX?: number;
  sourceY?: number;
  targetY?: number;
  sourceControlX?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: {
    colore?: ChiaveColoreFlusso;
    target?: NodoFlussoSankey;
  };
  palette: ChartPalette;
}

/** Link custom: curva con il colore semantico del nodo di destinazione (alpha da palette). */
function LinkSankey({ sourceX = 0, targetX = 0, sourceY = 0, targetY = 0, sourceControlX = 0, targetControlX = 0, linkWidth = 0, payload, palette }: LinkSankeyRenderProps) {
  const chiaveColore = payload?.colore ?? payload?.target?.colore ?? "netto";
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={palette.linkAlpha(palette[chiaveColore])}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  );
}

interface TooltipFlussoProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: unknown;
    value?: unknown;
    payload?: {
      name?: string;
      source?: NodoFlussoSankey;
      target?: NodoFlussoSankey;
    };
  }>;
}

/** Tooltip custom con Paper MUI: background.paper + bordo divider (dark/light automatici). */
function TooltipFlusso({ active, payload }: TooltipFlussoProps) {
  const item = payload?.[0];
  if (!active || !item) return null;
  const sorgente = item.payload?.source;
  const destinazione = item.payload?.target;
  const etichetta = sorgente && destinazione ? `${sorgente.name} → ${destinazione.name}` : String(item.payload?.name ?? item.name ?? "");
  const valore = typeof item.value === "number" ? item.value : Number(item.value ?? 0);
  return (
    <Paper
      elevation={0}
      sx={{ px: 1.5, py: 1, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        component="div"
      >
        {etichetta}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {`€ ${formatCurrency(valore)}`}
      </Typography>
    </Paper>
  );
}

interface SankeyFlussoCassaProps {
  riepilogo: RiepilogoDashboard;
  loading?: boolean;
}

/**
 * Firma visiva della dashboard: Sankey Recharts del flusso di denaro
 * (Vendite → Ricavo tracciato / non tracciato → Spese tracciate / non
 * tracciate → Netto). Valori clampati a ≥ 0 con nota testuale quando
 * avviene; saldo negativo segnalato con il valore reale. Colori nodi/link
 * ESCLUSIVAMENTE da useChartPalette. Export default richiesto da React.lazy:
 * questo è l'unico file della nuova dashboard che importa recharts.
 */
function SankeyFlussoCassa({ riepilogo, loading }: SankeyFlussoCassaProps) {
  const palette = useChartPalette();
  const { totaliAnno, anno } = riepilogo;

  const flusso = useMemo(() => clampaFlussoCassa(totaliAnno), [totaliAnno]);
  const dati = useMemo(() => costruisciFlussoSankey(flusso), [flusso]);

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2.5, height: "100%" }}
        data-testid="sankey-skeleton"
      >
        <Skeleton
          variant="text"
          width={200}
          height={28}
        />
        <Skeleton
          variant="rounded"
          height={ALTEZZA_GRAFICO}
          sx={{ mt: 2 }}
        />
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ mb: 1 }}
      >
        {`Flusso di cassa ${anno}`}
      </Typography>

      {totaliAnno.registri === 0 || dati.links.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: ALTEZZA_GRAFICO }}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {totaliAnno.registri === 0 ? `Nessun dato per il ${anno}.` : `Nessun flusso da visualizzare per il ${anno}.`}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, width: "100%", minHeight: ALTEZZA_GRAFICO }}>
          <ResponsiveContainer
            width="100%"
            height={ALTEZZA_GRAFICO}
          >
            <Sankey
              data={dati}
              node={<NodoSankey palette={palette} />}
              link={<LinkSankey palette={palette} />}
              nodePadding={28}
              nodeWidth={12}
              margin={{ top: 16, right: 16, bottom: 16, left: 8 }}
            >
              <Tooltip content={<TooltipFlusso />} />
            </Sankey>
          </ResponsiveContainer>
        </Box>
      )}

      {flusso.nettoNegativo && (
        <Typography
          variant="caption"
          color="error.main"
          fontWeight={600}
          sx={{ mt: 1 }}
        >
          {`Netto negativo (€ ${formatCurrency(flusso.nettoReale)}): le spese superano le vendite del ${anno}.`}
        </Typography>
      )}
      {flusso.note.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: flusso.nettoNegativo ? 0.5 : 1, fontStyle: "italic" }}
        >
          {flusso.note.join(" ")}
        </Typography>
      )}
    </Paper>
  );
}

export default SankeyFlussoCassa;
