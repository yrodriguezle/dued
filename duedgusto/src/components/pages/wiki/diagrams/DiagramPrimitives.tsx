import { ReactNode, useId } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { alpha, useTheme, type Theme } from "@mui/material/styles";

/**
 * Primitive per i diagrammi della wiki.
 *
 * Sono SVG disegnati a mano invece che generati da una libreria: i colori arrivano
 * dal tema MUI (quindi il diagramma segue tema chiaro e scuro) e il layout resta
 * sotto controllo. Ogni diagramma dichiara le proprie coordinate in un viewBox
 * fisso e la cornice lo scala alla larghezza disponibile.
 */

/** Famiglia visiva di un nodo: determina bordo, riempimento e colore dell'etichetta. */
export type DiagramTone =
  /** Aggregate root: il centro del diagramma. */
  | "root"
  /** Entità persistita ordinaria. */
  | "entity"
  /** Entità derivata/rigenerata, non inserita a mano. */
  | "derived"
  /** Tabella ponte fra due entità. */
  | "join"
  /** Classe di servizio: orchestrator, service, validator. */
  | "service"
  /** Elemento di contorno: enum, JSON, tabelle di altri domini. */
  | "external";

interface NodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  accent: string;
}

function nodeStyle(theme: Theme, tone: DiagramTone): NodeStyle {
  const paper = theme.palette.background.paper;
  switch (tone) {
    case "root":
      return {
        fill: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.22 : 0.1),
        stroke: theme.palette.primary.main,
        strokeWidth: 2,
        accent: theme.palette.primary.main,
      };
    case "derived":
      return {
        fill: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.09),
        stroke: theme.palette.success.main,
        strokeWidth: 1.5,
        accent: theme.palette.success.main,
      };
    case "join":
      return {
        fill: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
        stroke: theme.palette.warning.main,
        strokeWidth: 1.5,
        accent: theme.palette.warning.main,
      };
    case "service":
      return {
        fill: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.18 : 0.09),
        stroke: theme.palette.info.main,
        strokeWidth: 1.5,
        accent: theme.palette.info.main,
      };
    case "external":
      return {
        fill: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.06 : 0.03),
        stroke: theme.palette.divider,
        strokeWidth: 1.5,
        dash: "5 4",
        accent: theme.palette.text.secondary,
      };
    default:
      return {
        fill: paper,
        stroke: theme.palette.divider,
        strokeWidth: 1.5,
        accent: theme.palette.text.secondary,
      };
  }
}

const MONOSPACE = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

interface DiagramNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Nome della classe. */
  title: string;
  /** Riga in monospazio sotto il titolo: di norma la tabella corrispondente. */
  subtitle?: string;
  /** Righe di dettaglio, una per campo o concetto. */
  lines?: string[];
  tone?: DiagramTone;
}

/** Riquadro di una classe: titolo, tabella e righe di dettaglio. */
export function DiagramNode({ x, y, width, height, title, subtitle, lines = [], tone = "entity" }: DiagramNodeProps) {
  const theme = useTheme();
  const style = nodeStyle(theme, tone);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.dash}
      />
      <text
        x={x + 14}
        y={y + 25}
        fontSize={14}
        fontWeight={600}
        fill={theme.palette.text.primary}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={x + 14}
          y={y + 42}
          fontSize={10.5}
          fontFamily={MONOSPACE}
          fill={style.accent}
        >
          {subtitle}
        </text>
      )}
      {lines.map((line, index) => (
        <text
          key={`${line}-${index}`}
          x={x + 14}
          y={y + 62 + index * 15}
          fontSize={11}
          fill={theme.palette.text.secondary}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

interface DiagramEdgeProps {
  /** Vertici della spezzata, dal punto di partenza a quello di arrivo. */
  points: Array<[number, number]>;
  label?: string;
  labelAt?: [number, number];
  labelAnchor?: "start" | "middle" | "end";
  /** Tratteggiata: relazione logica, non una foreign key. */
  dashed?: boolean;
  /** Freccia in punta (default true). */
  arrow?: boolean;
  /** Colore attenuato per le relazioni di contorno. */
  muted?: boolean;
}

/** Freccia a spezzata fra due nodi, con etichetta opzionale. */
export function DiagramEdge({ points, label, labelAt, labelAnchor = "middle", dashed = false, arrow = true, muted = false }: DiagramEdgeProps) {
  const theme = useTheme();
  // useId produce ":r1:" che non è valido dentro url(#...): i due punti vanno tolti.
  const markerId = `wiki-arrow-${useId().replace(/:/g, "")}`;
  const color = muted ? theme.palette.text.disabled : theme.palette.text.secondary;

  return (
    <g>
      {arrow && (
        <defs>
          <marker
            id={markerId}
            markerWidth={9}
            markerHeight={9}
            refX={7}
            refY={3}
            orient="auto"
          >
            <path
              d="M0,0 L7,3 L0,6 z"
              fill={color}
            />
          </marker>
        </defs>
      )}
      <polyline
        points={points.map(([px, py]) => `${px},${py}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd={arrow ? `url(#${markerId})` : undefined}
      />
      {label && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fontSize={10.5}
          fill={color}
          textAnchor={labelAnchor}
        >
          {label}
        </text>
      )}
    </g>
  );
}

interface DiagramJunctionProps {
  x: number;
  y: number;
}

/** Pallino di derivazione su una linea condivisa da più percorsi. */
export function DiagramJunction({ x, y }: DiagramJunctionProps) {
  const theme = useTheme();
  return (
    <circle
      cx={x}
      cy={y}
      r={3.5}
      fill={theme.palette.text.secondary}
    />
  );
}

interface DiagramCaptionProps {
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
}

/** Testo libero dentro il diagramma (titoli di riga, note a margine). */
export function DiagramCaption({ x, y, text, anchor = "start" }: DiagramCaptionProps) {
  const theme = useTheme();
  return (
    <text
      x={x}
      y={y}
      fontSize={12}
      fontWeight={600}
      textAnchor={anchor}
      fill={theme.palette.text.secondary}
    >
      {text}
    </text>
  );
}

interface DiagramFrameProps {
  titolo: string;
  didascalia?: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  /** Sotto questa larghezza la cornice scorre in orizzontale invece di comprimere il disegno. */
  minWidth?: number;
  children: ReactNode;
}

/** Cornice del diagramma: intestazione, area scrollabile e SVG scalato alla larghezza. */
export function DiagramFrame({ titolo, didascalia, viewBoxWidth, viewBoxHeight, minWidth = 760, children }: DiagramFrameProps) {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 1.5, md: 2 }, my: 2 }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={600}
      >
        {titolo}
      </Typography>
      {didascalia && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1 }}
        >
          {didascalia}
        </Typography>
      )}
      <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
        <svg
          role="img"
          aria-label={titolo}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          style={{
            width: "100%",
            minWidth,
            height: "auto",
            display: "block",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          {children}
        </svg>
      </Box>
    </Paper>
  );
}
