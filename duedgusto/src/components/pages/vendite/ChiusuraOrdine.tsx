import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BackspaceOutlinedIcon from "@mui/icons-material/BackspaceOutlined";
import CallSplitIcon from "@mui/icons-material/CallSplit";

import formatCurrency from "../../../common/bones/formatCurrency";
import { METODI_PAGAMENTO, etichettaMetodo, isMetodoContante } from "./metodiPagamento";

interface ChiusuraOrdineProps {
  /** L'ordine da incassare. `null` tiene il foglio chiuso. */
  ordine: Ordine | null;
  inCorso?: boolean;
  onChiudi: () => void;
  onConferma: (tagli: TaglioOrdineInput[]) => void;
  /** Assente, l'ingresso allo split non compare. */
  onDividi?: () => void;
}

/** I tagli in cui si digita un importo: 5, 10, 20, 50 sono le banconote che arrivano al banco. */
const BANCONOTE = [5, 10, 20, 50];

/** 1-9, poi «00», 0 e la cancellazione: tre colonne, che a 360 px danno bersagli da ~110 px. */
const TASTI: (number | "00" | "canc")[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0, "canc"];

/**
 * Il foglio che chiude l'ordine: **una sola scelta di metodo per l'intero conto**.
 *
 * <p>Era il secondo tocco di ogni consumazione e ora è l'ultimo dell'ordine, ed è il senso di
 * tutto il change: al bancone non si sa come pagheranno finché non arrivano alla cassa, e
 * chiederlo a ogni birra costringeva a indovinare otto volte.</p>
 *
 * <p>Il **gesto** invece non cambia: sale dal basso e non è un dialog centrato, bersagli ≥ 56 px,
 * nessuna azione distruttiva adiacente. È il gesto che si fa con una mano sola, senza guardare,
 * col telefono tenuto in basso — tre bersagli a metà schermo costringerebbero a cambiare presa.</p>
 *
 * 🔴 Con un metodo in contanti compare il **tastierino**, e quello che mostra si chiama
 *    «Resto da rendere», mai «Resto» da solo: `RegistroCassa.resto` è la colonna AG del foglio di
 *    chiusura e significa un'altra cosa. Il valore digitato non tocca alcun secchio: è un aiuto
 *    all'operatore, non un dato contabile.
 */
function ChiusuraOrdine({ ordine, inCorso = false, onChiudi, onConferma, onDividi }: ChiusuraOrdineProps) {
  const [metodoScelto, setMetodoScelto] = useState<MetodoPagamentoVendita | null>(null);
  // In centesimi, e non in euro con la virgola: al banco si digita «2 0 0 0» per venti euro senza
  // mai cercare il tasto del separatore, e non esiste un valore intermedio che sia mezzo decimale.
  const [centesimi, setCentesimi] = useState(0);

  // Ogni apertura riparte pulita: il metodo dell'ordine precedente e la cifra digitata per un
  // altro cliente non hanno nulla a che vedere con questo conto.
  //
  // ⚠️ La dipendenza è l'**id**, non l'oggetto: le query girano con `cache-and-network` e
  //    restituiscono un oggetto nuovo a ogni rilettura dello stesso ordine. Con l'oggetto in
  //    dipendenza, una rilettura in sottofondo azzererebbe il tastierino mentre l'operatore sta
  //    digitando quanto ha ricevuto.
  const ordineId = ordine?.ordineId;
  useEffect(() => {
    if (ordineId) {
      setMetodoScelto(null);
      setCentesimi(0);
    }
  }, [ordineId]);

  const totale = ordine?.totaleCorrente ?? 0;
  const righeOrdineId = useMemo(() => (ordine?.righe ?? []).map((riga) => riga.rigaOrdineId), [ordine]);

  const ricevuto = centesimi / 100;
  const copre = centesimi > 0 && ricevuto + 1e-9 >= totale;
  const restoDaRendere = copre ? ricevuto - totale : 0;

  const confermaTaglioUnico = useCallback(
    (metodo: MetodoPagamentoVendita, contanteRicevuto: number | null) => {
      onConferma([{ metodoPagamento: metodo, righeOrdineId, contanteRicevuto }]);
    },
    [onConferma, righeOrdineId]
  );

  const handleScegliMetodo = useCallback(
    (metodo: MetodoPagamentoVendita) => {
      // 🔴 L'elettronico conferma subito, e il campo del contante non viene nemmeno proposto:
      //    non significa nulla lì, e il server lo rifiuterebbe. Il tastierino compare solo dove
      //    serve — che è anche il modo di non aggiungere un tocco a chi paga con la carta.
      if (!isMetodoContante(metodo)) {
        confermaTaglioUnico(metodo, null);
        return;
      }
      setMetodoScelto(metodo);
      setCentesimi(0);
    },
    [confermaTaglioUnico]
  );

  const handleTasto = useCallback((tasto: (typeof TASTI)[number]) => {
    setCentesimi((precedente) => {
      if (tasto === "canc") {
        return Math.floor(precedente / 10);
      }
      const aggiunta = tasto === "00" ? precedente * 100 : precedente * 10 + tasto;
      // Un milione di euro di consumazione non esiste: il tetto evita che un dito appoggiato
      // produca un numero che poi non si riesce più a leggere.
      return Math.min(aggiunta, 99_999_999);
    });
  }, []);

  return (
    <Drawer
      anchor="bottom"
      open={Boolean(ordine)}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "92dvh" } } }}
    >
      {ordine && (
        <Box sx={{ p: 2, pb: 3, maxWidth: 560, mx: "auto", width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                {/* L'identificativo compare già qui e non solo sullo scontrino: vedere il numero
                    salire a ogni ordine è ciò che fa notare subito un duplicato. */}
                Ordine {ordine.identificativo} · {ordine.righe.length} {ordine.righe.length === 1 ? "voce" : "voci"}
              </Typography>
              <Typography
                variant="h4"
                sx={{ lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}
              >
                {formatCurrency(totale)} €
              </Typography>
            </Box>

            {onDividi && metodoScelto === null && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<CallSplitIcon />}
                onClick={onDividi}
                disabled={inCorso || ordine.righe.length < 2}
                sx={{ minHeight: 48, flexShrink: 0 }}
              >
                Dividi
              </Button>
            )}
          </Box>

          {metodoScelto === null && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {METODI_PAGAMENTO.map((metodo) => {
                const Icona = metodo.icona;
                return (
                  <Button
                    key={metodo.valore}
                    variant="contained"
                    color={metodo.colore}
                    size="large"
                    disabled={inCorso || ordine.righe.length === 0}
                    startIcon={<Icona />}
                    onClick={() => handleScegliMetodo(metodo.valore)}
                    sx={{
                      minHeight: 56,
                      justifyContent: "flex-start",
                      textAlign: "left",
                      textTransform: "none",
                      px: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                      <Typography
                        component="span"
                        sx={{ fontWeight: 600 }}
                      >
                        {metodo.etichetta}
                      </Typography>
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ opacity: 0.85 }}
                      >
                        {metodo.effetto}
                      </Typography>
                    </Box>
                  </Button>
                );
              })}
            </Box>
          )}

          {metodoScelto !== null && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setMetodoScelto(null)}
                  disabled={inCorso}
                  sx={{ minHeight: 44 }}
                >
                  {etichettaMetodo(metodoScelto)}
                </Button>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  border: 1,
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Contante ricevuto
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCurrency(ricevuto)} €
                </Typography>
              </Box>

              {/* 🔴 «Resto da rendere», mai «Resto» da solo. E un ricevuto che non copre il
                  totale non produce un resto negativo spacciato per un numero valido: dice
                  quanto manca, che è l'informazione con cui si torna a chiedere al cliente. */}
              <Box sx={{ minHeight: 56, display: "flex", alignItems: "center", mt: 1 }}>
                {centesimi === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Digita quanto ha dato il cliente, oppure conferma l'importo esatto.
                  </Typography>
                )}
                {centesimi > 0 && !copre && (
                  <Alert
                    severity="warning"
                    sx={{ width: "100%", py: 0 }}
                  >
                    Non copre il totale: mancano {formatCurrency(totale - ricevuto)} €
                  </Alert>
                )}
                {copre && (
                  <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Resto da rendere
                    </Typography>
                    <Typography
                      variant="h5"
                      color={restoDaRendere > 0 ? "success.main" : "text.primary"}
                      sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCurrency(restoDaRendere)} €
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 0.75, mb: 1, flexWrap: "wrap" }}>
                {BANCONOTE.map((taglio) => (
                  <Chip
                    key={taglio}
                    label={`${taglio} €`}
                    onClick={() => setCentesimi(taglio * 100)}
                    disabled={inCorso}
                    sx={{ height: 40, px: 0.5, flex: "1 1 auto" }}
                  />
                ))}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
                {TASTI.map((tasto) => (
                  <ButtonBase
                    key={String(tasto)}
                    aria-label={tasto === "canc" ? "Cancella ultima cifra" : `Cifra ${tasto}`}
                    onClick={() => handleTasto(tasto)}
                    disabled={inCorso}
                    sx={{
                      // Stessa disciplina delle tessere del listino: bersagli grossi, premibili
                      // di sbieco, con la deformazione al tocco invece del colore — sul telefono
                      // l'hover non esiste.
                      minHeight: 56,
                      borderRadius: 2,
                      border: 1,
                      borderColor: "divider",
                      bgcolor: "action.hover",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      transition: "transform 80ms ease-out",
                      "&:active": { transform: "scale(0.96)" },
                      "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:active": { transform: "none" } },
                    }}
                  >
                    {tasto === "canc" ? <BackspaceOutlinedIcon /> : tasto}
                  </ButtonBase>
                ))}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={inCorso}
                  onClick={() => confermaTaglioUnico(metodoScelto, null)}
                  sx={{ minHeight: 56, flex: 1 }}
                >
                  Importo esatto
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  disabled={inCorso || !copre}
                  onClick={() => confermaTaglioUnico(metodoScelto, ricevuto)}
                  sx={{ minHeight: 56, flex: 1.4 }}
                >
                  Incassa {formatCurrency(totale)} €
                </Button>
              </Box>
            </Box>
          )}

          <Button
            fullWidth
            onClick={onChiudi}
            disabled={inCorso}
            sx={{ mt: 1.5, minHeight: 44 }}
          >
            Annulla
          </Button>
        </Box>
      )}
    </Drawer>
  );
}

export default ChiusuraOrdine;
