import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

import formatCurrency from "../../../common/bones/formatCurrency";
import { METODI_PAGAMENTO } from "./metodiPagamento";

interface SplitOrdineProps {
  aperto: boolean;
  ordine: Ordine | null;
  inCorso?: boolean;
  onChiudi: () => void;
  onConferma: (tagli: TaglioOrdineInput[]) => void;
}

/** A, B, C… — lo stesso suffisso che il server scrive sui figli dello split. */
function lettera(indice: number): string {
  return String.fromCharCode(65 + indice);
}

/**
 * «Il mio spritz lo pago io, il tuo lo paghi tu»: si assegnano **le voci** alle parti, e ogni
 * parte ha il suo metodo di pagamento.
 *
 * 🔴 **La divisione per importo non è supportata, e la pagina lo dice prima.** «30 € in tutto, 20
 *    in contanti e 10 con carta» non si può fare: il server non la accetta e il contratto non la
 *    sa nemmeno esprimere. Scoprirlo alla cassa, col cliente davanti, sarebbe il momento
 *    peggiore — quindi il limite sta scritto in cima al foglio, non in un messaggio d'errore.
 *
 * <p>La conferma resta bloccata finché ogni voce non è assegnata a esattamente una parte: una
 * voce dimenticata sparirebbe dal conto, e una assegnata due volte la farebbe pagare due volte.
 * Il server rifiuta entrambe le cose, ma un rifiuto arriva sempre più tardi di un pulsante
 * spento.</p>
 */
function SplitOrdine({ aperto, ordine, inCorso = false, onChiudi, onConferma }: SplitOrdineProps) {
  const righe = useMemo(() => ordine?.righe ?? [], [ordine]);

  // Due parti è il caso che si presenta praticamente sempre: il conto in due. Le altre si
  // aggiungono a mano, e ognuna nasce col metodo che il banco usa di più.
  const [metodiParti, setMetodiParti] = useState<MetodoPagamentoVendita[]>(["ELETTRONICO", "CONTANTE_TRACCIATO"]);
  const [parteCorrente, setParteCorrente] = useState(0);
  /** `rigaOrdineId → indice della parte`. Le righe assenti da qui non sono ancora assegnate. */
  const [assegnazioni, setAssegnazioni] = useState<Record<number, number>>({});

  // Riaprire il foglio su un altro ordine non deve ereditare le assegnazioni del precedente:
  // sarebbero riferite a righe che non esistono più, e il pulsante di conferma sembrerebbe
  // sbloccato per un conto che nessuno ha ancora diviso.
  useEffect(() => {
    if (aperto) {
      setMetodiParti(["ELETTRONICO", "CONTANTE_TRACCIATO"]);
      setParteCorrente(0);
      setAssegnazioni({});
    }
  }, [aperto, ordine?.ordineId]);

  const totaliParti = useMemo(
    () =>
      metodiParti.map((_, indice) =>
        righe.filter((riga) => assegnazioni[riga.rigaOrdineId] === indice).reduce((somma, riga) => somma + riga.prezzoTotale, 0)
      ),
    [assegnazioni, metodiParti, righe]
  );

  const righeNonAssegnate = useMemo(() => righe.filter((riga) => assegnazioni[riga.rigaOrdineId] === undefined), [assegnazioni, righe]);

  const partiVuote = useMemo(
    () => metodiParti.filter((_, indice) => !righe.some((riga) => assegnazioni[riga.rigaOrdineId] === indice)),
    [assegnazioni, metodiParti, righe]
  );

  const puoConfermare = righe.length > 0 && righeNonAssegnate.length === 0 && partiVuote.length === 0 && !inCorso;

  const handleAssegna = useCallback(
    (riga: RigaOrdine) => {
      setAssegnazioni((precedenti) => ({ ...precedenti, [riga.rigaOrdineId]: parteCorrente }));
    },
    [parteCorrente]
  );

  const handleAggiungiParte = useCallback(() => {
    setMetodiParti((precedenti) => [...precedenti, "CONTANTE_TRACCIATO"]);
    setParteCorrente(metodiParti.length);
  }, [metodiParti.length]);

  const handleTogliUltimaParte = useCallback(() => {
    const indiceTolto = metodiParti.length - 1;
    setMetodiParti((precedenti) => precedenti.slice(0, -1));
    // Le voci della parte tolta tornano non assegnate invece di finire in un'altra: spostarle da
    // sole cambierebbe il conto di qualcuno senza dirlo.
    setAssegnazioni((precedenti) =>
      Object.fromEntries(Object.entries(precedenti).filter(([, parte]) => parte !== indiceTolto))
    );
    setParteCorrente((precedente) => Math.min(precedente, indiceTolto - 1));
  }, [metodiParti.length]);

  const handleCambiaMetodo = useCallback(
    (metodo: MetodoPagamentoVendita) => {
      setMetodiParti((precedenti) => precedenti.map((valore, indice) => (indice === parteCorrente ? metodo : valore)));
    },
    [parteCorrente]
  );

  const handleConferma = useCallback(() => {
    // ⚠️ `contanteRicevuto` resta assente su ogni taglio: significa «importo esatto». Il conto del
    //    resto è del foglio di chiusura semplice, dove c'è un solo importo da rendere; qui
    //    sarebbero n tastierini in fila, e il resto lo si fa comunque una volta sola alla fine.
    const tagli: TaglioOrdineInput[] = metodiParti.map((metodo, indice) => ({
      metodoPagamento: metodo,
      righeOrdineId: righe.filter((riga) => assegnazioni[riga.rigaOrdineId] === indice).map((riga) => riga.rigaOrdineId),
    }));
    onConferma(tagli);
  }, [assegnazioni, metodiParti, onConferma, righe]);

  return (
    <Drawer
      anchor="bottom"
      open={aperto && Boolean(ordine)}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "92dvh" } } }}
    >
      {ordine && (
        <Box sx={{ p: 2, maxWidth: 640, mx: "auto", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Typography
            variant="h6"
            gutterBottom
          >
            Dividi l'ordine {ordine.identificativo}
          </Typography>

          <Alert
            severity="info"
            sx={{ mb: 1.5 }}
          >
            <AlertTitle>Si divide per voci, non per importo</AlertTitle>
            Assegna ogni consumazione alla parte che la paga. Dividere lo stesso conto in cifre — per esempio 20 € in contanti e 10 con carta sulle stesse voci — non è
            supportato.
          </Alert>

          <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.75, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {metodiParti.map((_, indice) => (
              <Chip
                key={indice}
                label={`Parte ${lettera(indice)} · ${formatCurrency(totaliParti[indice])} €`}
                color={parteCorrente === indice ? "primary" : "default"}
                onClick={() => setParteCorrente(indice)}
                sx={{ height: 40, flexShrink: 0 }}
              />
            ))}
            <Chip
              icon={<AddIcon />}
              label="Parte"
              variant="outlined"
              onClick={handleAggiungiParte}
              disabled={inCorso || metodiParti.length >= righe.length}
              sx={{ height: 40, flexShrink: 0 }}
            />
            {metodiParti.length > 2 && (
              <Chip
                icon={<RemoveCircleOutlineIcon />}
                label={`Togli ${lettera(metodiParti.length - 1)}`}
                variant="outlined"
                onClick={handleTogliUltimaParte}
                disabled={inCorso}
                sx={{ height: 40, flexShrink: 0 }}
              />
            )}
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            Come paga la parte {lettera(parteCorrente)}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1 }}>
            {METODI_PAGAMENTO.map((metodo) => (
              <Chip
                key={metodo.valore}
                label={metodo.etichetta}
                color={metodiParti[parteCorrente] === metodo.valore ? metodo.colore : "default"}
                onClick={() => handleCambiaMetodo(metodo.valore)}
                disabled={inCorso}
                sx={{ height: 40 }}
              />
            ))}
          </Box>

          <Divider sx={{ mb: 1 }} />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 0.5 }}
          >
            Tocca una voce per assegnarla alla parte {lettera(parteCorrente)}
          </Typography>

          <Box sx={{ overflow: "auto", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
            {righe.map((riga) => {
              const parte = assegnazioni[riga.rigaOrdineId];
              const assegnata = parte !== undefined;
              return (
                <ButtonBase
                  key={riga.rigaOrdineId}
                  onClick={() => handleAssegna(riga)}
                  disabled={inCorso}
                  sx={{
                    minHeight: 56,
                    px: 1.5,
                    borderRadius: 2,
                    border: 1,
                    // La voce ancora da assegnare si vede senza leggere: tratteggio invece di
                    // linea piena, ed è il solo modo in cui il foglio dice «manca questa».
                    borderStyle: assegnata ? "solid" : "dashed",
                    borderColor: assegnata ? "primary.main" : "warning.main",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    textAlign: "left",
                  }}
                >
                  <Chip
                    size="small"
                    label={assegnata ? lettera(parte) : "—"}
                    color={assegnata ? "primary" : "warning"}
                    sx={{ flexShrink: 0, width: 40 }}
                  />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                  >
                    {riga.quantita > 1 ? `${riga.quantita}× ` : ""}
                    {riga.prodotto?.nome ?? `Prodotto ${riga.prodottoId}`}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
                  >
                    {formatCurrency(riga.prezzoTotale)} €
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>

          {righeNonAssegnate.length > 0 && (
            <Alert
              severity="warning"
              sx={{ mt: 1 }}
            >
              {righeNonAssegnate.length === 1 ? "Resta 1 voce da assegnare" : `Restano ${righeNonAssegnate.length} voci da assegnare`}
            </Alert>
          )}

          {righeNonAssegnate.length === 0 && partiVuote.length > 0 && (
            <Alert
              severity="warning"
              sx={{ mt: 1 }}
            >
              Una parte è rimasta senza voci: toglila oppure assegnale qualcosa.
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
            <Button
              onClick={onChiudi}
              disabled={inCorso}
              sx={{ minHeight: 56, flex: 1 }}
            >
              Annulla
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleConferma}
              disabled={!puoConfermare}
              sx={{ minHeight: 56, flex: 1.4 }}
            >
              Incassa in {metodiParti.length} parti
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export default SplitOrdine;
