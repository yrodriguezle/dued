import { ReactNode, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import dayjs from "dayjs";

import ChiusuraOrdine from "./ChiusuraOrdine";
import DialogMotivo from "./DialogMotivo";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { getOrdiniAperti } from "../../../graphql/ordini/queries";
import { mutationAnnullaOrdine, mutationChiudiOrdine } from "../../../graphql/ordini/mutations";

interface OrdiniApertiProps {
  aperto: boolean;
  /**
   * Limita l'elenco a un registro. **Omesso, li mostra tutti** — ed è il caso normale al banco:
   * un ordine aperto ieri sera è ancora aperto stamattina, e nasconderlo lo renderebbe
   * irraggiungibile proprio mentre blocca la chiusura di ieri.
   */
  registroCassaId?: number | null;
  onChiudi: () => void;
  /** Assente, l'azione «riprendi» non compare: fuori dal punto vendita non c'è dove riprenderlo. */
  onRiprendi?: (ordine: Ordine) => void;
  /** Chiamato dopo ogni incasso o annullo riuscito, per far riallineare chi sta intorno. */
  onRisolto?: () => Promise<void> | void;
  titolo?: string;
  descrizione?: ReactNode;
}

/** I motivi che si ripetono ogni sera. Restano modificabili: il campo è libero. */
const MOTIVI_FREQUENTI = ["Cliente andato via", "Ordine battuto due volte", "Errore di battitura"];

/**
 * L'elenco degli ordini ancora aperti, con **le due uscite su ogni riga**: incassare o annullare.
 *
 * <p>È la schermata che rende risolvibile il blocco della chiusura di cassa. La guardia del
 * server risponde «2 ordini ancora aperti per 30,00 €», ed è l'informazione giusta; senza un
 * posto in cui vederli elencati e agirci sopra, però, l'operatore leggerebbe il problema e non
 * avrebbe dove risolverlo.</p>
 *
 * 🔴 **Ogni riga porta la data del registro**, e non è ridondanza. Un ordine aperto alle 23:50 sta
 *    sul registro di ieri e alle 00:05 è ancora lì: chi lo cercasse fra quelli di oggi non lo
 *    troverebbe. La riga lo dice, con un contrassegno quando il giorno non è quello corrente.
 */
function OrdiniAperti({ aperto, registroCassaId, onChiudi, onRiprendi, onRisolto, titolo, descrizione }: OrdiniApertiProps) {
  const [ordineDaIncassare, setOrdineDaIncassare] = useState<Ordine | null>(null);
  const [ordineDaAnnullare, setOrdineDaAnnullare] = useState<Ordine | null>(null);

  const {
    data,
    loading,
    refetch,
  } = useQuery(getOrdiniAperti, {
    variables: { registroCassaId: registroCassaId ?? null },
    skip: !aperto,
    fetchPolicy: "cache-and-network",
  });

  const [chiudiOrdine, { loading: chiusuraInCorso }] = useMutation(mutationChiudiOrdine);
  const [annullaOrdine, { loading: annullamentoInCorso }] = useMutation(mutationAnnullaOrdine);

  const ordini = useMemo(() => data?.vendite?.ordiniAperti ?? [], [data]);
  const oggi = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  const totaleAperto = useMemo(() => ordini.reduce((somma, ordine) => somma + ordine.totaleCorrente, 0), [ordini]);

  const dopoLAzione = useCallback(async () => {
    await refetch();
    await onRisolto?.();
  }, [onRisolto, refetch]);

  const handleIncassa = useCallback(
    async (tagli: TaglioOrdineInput[]) => {
      if (!ordineDaIncassare) {
        return;
      }
      try {
        const esito = await chiudiOrdine({ variables: { input: { ordineId: ordineDaIncassare.ordineId, tagli } } });
        const resto = esito.data?.vendite?.chiudiOrdine?.restoDaRendere ?? 0;
        setOrdineDaIncassare(null);
        await dopoLAzione();
        showToast({
          type: "success",
          position: "bottom-center",
          message: resto > 0 ? `Ordine incassato · resto da rendere ${formatCurrency(resto)} €` : "Ordine incassato",
          autoClose: 3500,
          toastId: "ordine-incassato",
        });
      } catch (errore) {
        // 🔴 Nessun ritentativo automatico: la chiusura muove i secchi per delta e non è
        //    idempotente. Riprovare da soli raddoppierebbe l'incasso in silenzio.
        showToast({
          type: "error",
          position: "bottom-center",
          message: errore instanceof Error ? errore.message : "Ordine non incassato",
          autoClose: 8000,
          toastId: "ordine-incasso-errore",
        });
      }
    },
    [chiudiOrdine, dopoLAzione, ordineDaIncassare]
  );

  const handleConfermaAnnullo = useCallback(
    async (motivo: string) => {
    if (!ordineDaAnnullare) {
      return;
    }
    try {
      await annullaOrdine({ variables: { ordineId: ordineDaAnnullare.ordineId, motivo } });
      setOrdineDaAnnullare(null);
      await dopoLAzione();
      showToast({ type: "success", position: "bottom-center", message: "Ordine annullato", autoClose: 2500, toastId: "ordine-annullato" });
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-center",
        message: errore instanceof Error ? errore.message : "Annullamento non riuscito",
        autoClose: 8000,
        toastId: "ordine-annullo-errore",
      });
    }
    },
    [annullaOrdine, dopoLAzione, ordineDaAnnullare]
  );

  const inCorso = chiusuraInCorso || annullamentoInCorso;

  return (
    <>
      <Drawer
        anchor="bottom"
        open={aperto}
        onClose={onChiudi}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88dvh" } } }}
      >
        <Box sx={{ p: 2, maxWidth: 640, mx: "auto", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Typography
            variant="h6"
            gutterBottom
          >
            {titolo ?? "Ordini aperti"}
          </Typography>

          {descrizione && (
            <Alert
              severity="warning"
              sx={{ mb: 1.5 }}
            >
              {descrizione}
            </Alert>
          )}

          {ordini.length > 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              {ordini.length === 1 ? "1 ordine" : `${ordini.length} ordini`} per {formatCurrency(totaleAperto)} € ancora da incassare.
            </Typography>
          )}

          <Divider sx={{ mb: 1 }} />

          <Box sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {loading && ordini.length === 0 && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {!loading && ordini.length === 0 && <Alert severity="success">Nessun ordine aperto: tutto è stato incassato o annullato.</Alert>}

            {ordini.map((ordine) => {
              const diUnAltroGiorno = dayjs(ordine.dataRegistro).format("YYYY-MM-DD") !== oggi;
              return (
                <Box
                  key={ordine.ordineId}
                  sx={{ py: 1.25, borderBottom: 1, borderColor: "divider" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600 }}
                      >
                        {ordine.identificativo}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, flexWrap: "wrap" }}>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={diUnAltroGiorno ? "warning" : "default"}
                          icon={diUnAltroGiorno ? <EventBusyIcon /> : undefined}
                          label={`Cassa del ${dayjs(ordine.dataRegistro).format("DD/MM/YYYY")}`}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {ordine.righe.length} {ordine.righe.length === 1 ? "voce" : "voci"} · aperto alle {dayjs(ordine.apertoIl).format("HH:mm")}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography
                      variant="h6"
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCurrency(ordine.totaleCorrente)} €
                    </Typography>
                  </Box>

                  {/* Le due azioni sono su una riga propria e con la stessa altezza dei bersagli
                      del resto della pagina: sono le due uscite dal blocco, non due dettagli. */}
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    {onRiprendi && (
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<PointOfSaleIcon />}
                        disabled={inCorso}
                        onClick={() => onRiprendi(ordine)}
                        sx={{ minHeight: 48, flex: 1 }}
                      >
                        Riprendi
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      disabled={inCorso || ordine.righe.length === 0}
                      onClick={() => setOrdineDaIncassare(ordine)}
                      sx={{ minHeight: 48, flex: 1.2 }}
                    >
                      Incassa
                    </Button>
                    {/* 🔴 «Annulla», non «storna»: sono due gesti diversi. Qui l'ordine è ancora
                        aperto e non ha mosso un centesimo, quindi non c'è nulla da disfare — lo
                        storno vive sullo scontrino, su ordini già incassati, ed è per i soli
                        amministratori. */}
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={inCorso}
                      onClick={() => setOrdineDaAnnullare(ordine)}
                      sx={{ minHeight: 48, flex: 1 }}
                    >
                      Annulla
                    </Button>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Button
            fullWidth
            onClick={onChiudi}
            sx={{ mt: 1.5, minHeight: 44 }}
          >
            Chiudi
          </Button>
        </Box>
      </Drawer>

      <ChiusuraOrdine
        ordine={ordineDaIncassare}
        inCorso={chiusuraInCorso}
        onChiudi={() => setOrdineDaIncassare(null)}
        onConferma={handleIncassa}
      />

      <DialogMotivo
        aperto={Boolean(ordineDaAnnullare)}
        titolo={`Annulla l'ordine ${ordineDaAnnullare?.identificativo ?? ""}`}
        spiegazione="L'ordine non sparisce e resta consultabile: nessun incasso viene toccato, perché non ne è mai stato dichiarato uno."
        suggerimenti={MOTIVI_FREQUENTI}
        etichettaConferma="Annulla l'ordine"
        inCorso={annullamentoInCorso}
        onChiudi={() => setOrdineDaAnnullare(null)}
        onConferma={handleConfermaAnnullo}
      />
    </>
  );
}

export default OrdiniAperti;
