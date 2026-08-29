import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import UndoIcon from "@mui/icons-material/Undo";
import dayjs from "dayjs";

import DialogMotivo from "./DialogMotivo";
import { METODI_PAGAMENTO, etichettaMetodo } from "./metodiPagamento";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import useStore from "../../../store/useStore";
import { getOrdiniDelRegistro } from "../../../graphql/ordini/queries";
import { mutationStornaOrdine } from "../../../graphql/ordini/mutations";
import { mutationAggiornaVendita, mutationEliminaVendita } from "../../../graphql/vendite/mutations";

interface ScontrinoDelGiornoProps {
  aperto: boolean;
  vendite: Vendita[];
  registroCassa: RegistroCassa;
  onChiudi: () => void;
  onModificato: () => Promise<void> | void;
}

/** Chiave del gruppo delle righe senza ordine: le vendite battute col vecchio regime diretto. */
const SENZA_ORDINE = 0;

/**
 * Lo scontrino del giorno: **ciò che è stato davvero incassato**, raggruppato per ordine.
 *
 * <p>Le righe qui dentro esistono solo se qualcuno ha pagato: una `Vendita` nasce alla chiusura
 * dell'ordine e non prima, quindi un ordine ancora aperto **non compare** in questa lista. È la
 * proprietà che rende leggibile il totale — non è «quanto è stato battuto», è «quanto è
 * entrato».</p>
 *
 * 🔴 **Le righe nate da un ordine non si correggono più una per una**, ed è la conseguenza
 *    diretta della guardia: `aggiornaVendita` ed `eliminaVendita` le rifiutano, perché toccarle
 *    muoverebbe i secchi una seconda volta senza passare dalla transizione che li protegge. La
 *    via d'uscita è **stornare l'ordine intero** — un solo delta inverso, applicato una volta
 *    sola, e solo da un amministratore. Le due icone di riga sopravvivono per le sole righe di
 *    sviluppo battute col vecchio regime, che un ordine dietro non ce l'hanno.
 */
function ScontrinoDelGiorno({ aperto, vendite, registroCassa, onChiudi, onModificato }: ScontrinoDelGiornoProps) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const [venditaInModifica, setVenditaInModifica] = useState<Vendita | null>(null);
  const [ordineDaStornare, setOrdineDaStornare] = useState<number | null>(null);

  const utente = useStore((state) => state.utente);
  // Lo storno è un'operazione da amministratore anche lato server: nascondere il pulsante a chi
  // non può usarlo evita di far scoprire il divieto dopo aver scritto un motivo.
  const isAmministratore = Boolean(utente?.ruolo?.amministratore);

  const [aggiornaVendita] = useMutation(mutationAggiornaVendita);
  const [eliminaVendita] = useMutation(mutationEliminaVendita);
  const [stornaOrdine, { loading: stornoInCorso }] = useMutation(mutationStornaOrdine);

  // Serve solo l'identificativo leggibile: le vendite portano `ordineId`, che è un numero di
  // riga di tabella e non dice niente a chi guarda lo scontrino.
  const { data: datiOrdini, refetch: ricaricaOrdini } = useQuery(getOrdiniDelRegistro, {
    variables: { registroCassaId: registroCassa.id, stati: ["CHIUSO"] },
    skip: !aperto || !registroCassa.id,
    fetchPolicy: "cache-and-network",
  });

  const ordiniPerId = useMemo(
    () => new Map((datiOrdini?.vendite?.ordiniDelRegistro ?? []).map((ordine) => [ordine.ordineId, ordine])),
    [datiOrdini]
  );

  const totaliPerMetodo = useMemo(
    () =>
      METODI_PAGAMENTO.map((metodo) => ({
        ...metodo,
        totale: vendite.filter((v) => v.metodoPagamento === metodo.valore).reduce((somma, v) => somma + v.prezzoTotale, 0),
        righe: vendite.filter((v) => v.metodoPagamento === metodo.valore).length,
      })),
    [vendite]
  );

  const totaleItemizzato = useMemo(() => vendite.reduce((somma, v) => somma + v.prezzoTotale, 0), [vendite]);

  // 🔴 La condizione che oggi finisce solo in un warning nel log del server: se si batte più di
  //    quanto il registro dichiara, il residuo IVA va negativo, viene portato a zero e la riga
  //    stimata sparisce — senza che nulla lo dica a nessuno. Qui si vede.
  const sforamento = totaleItemizzato - (registroCassa.totaleVendite ?? 0);

  // I gruppi seguono l'ordine di apparizione delle vendite, che è quello di chiusura: lo
  // scontrino si legge dall'alto come si è incassato.
  const gruppi = useMemo(() => {
    const perOrdine = vendite.reduce((mappa, vendita) => {
      const chiave = vendita.ordineId ?? SENZA_ORDINE;
      mappa.set(chiave, [...(mappa.get(chiave) ?? []), vendita]);
      return mappa;
    }, new Map<number, Vendita[]>());

    return [...perOrdine.entries()].map(([ordineId, righe]) => ({
      ordineId,
      righe,
      totale: righe.reduce((somma, riga) => somma + riga.prezzoTotale, 0),
      identificativo: ordiniPerId.get(ordineId)?.identificativo,
    }));
  }, [ordiniPerId, vendite]);

  const eseguiEAggiorna = useCallback(
    async (azione: () => Promise<unknown>, messaggio: string) => {
      try {
        await azione();
        await onModificato();
        showToast({ type: "success", position: "bottom-center", message: messaggio, autoClose: 2500, toastId: "scontrino-ok" });
      } catch (errore) {
        showToast({
          type: "error",
          position: "bottom-center",
          message: errore instanceof Error ? errore.message : "Operazione non riuscita",
          autoClose: 8000,
          toastId: "scontrino-errore",
        });
      }
    },
    [onModificato]
  );

  const handleCambiaMetodo = useCallback(
    (metodo: MetodoPagamentoVendita) => {
      const vendita = venditaInModifica;
      setAncora(null);
      setVenditaInModifica(null);
      if (!vendita || vendita.metodoPagamento === metodo) {
        return;
      }
      void eseguiEAggiorna(
        () => aggiornaVendita({ variables: { id: vendita.venditaId, input: { metodoPagamento: metodo } } }),
        `Spostato in «${etichettaMetodo(metodo)}»`
      );
    },
    [aggiornaVendita, eseguiEAggiorna, venditaInModifica]
  );

  const handleElimina = useCallback(
    (vendita: Vendita) => {
      void eseguiEAggiorna(() => eliminaVendita({ variables: { id: vendita.venditaId } }), "Riga eliminata");
    },
    [eliminaVendita, eseguiEAggiorna]
  );

  const handleStorna = useCallback(
    (motivo: string) => {
      const ordineId = ordineDaStornare;
      setOrdineDaStornare(null);
      if (!ordineId) {
        return;
      }
      void eseguiEAggiorna(async () => {
        await stornaOrdine({ variables: { ordineId, motivo } });
        await ricaricaOrdini();
      }, "Ordine stornato");
    },
    [eseguiEAggiorna, ordineDaStornare, ricaricaOrdini, stornaOrdine]
  );

  return (
    <Drawer
      anchor="bottom"
      open={aperto}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "85dvh" } } }}
    >
      <Box sx={{ p: 2, maxWidth: 640, mx: "auto", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Typography
          variant="h6"
          gutterBottom
        >
          Scontrino del giorno
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 1.5 }}>
          {totaliPerMetodo.map((metodo) => (
            <Box
              key={metodo.valore}
              sx={{ minWidth: 130 }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                {metodo.etichetta}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
              >
                {formatCurrency(metodo.totale)}
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  {" "}
                  · {metodo.righe} righe
                </Typography>
              </Typography>
            </Box>
          ))}
        </Box>

        {sforamento > 0 && (
          <Alert
            severity="warning"
            sx={{ mb: 1.5 }}
          >
            <AlertTitle>Battuto più di quanto il registro dichiara</AlertTitle>
            Itemizzato {formatCurrency(totaleItemizzato)} contro un totale vendite di {formatCurrency(registroCassa.totaleVendite ?? 0)}. La ripartizione IVA perde la riga
            stimata: o manca un incasso nel registro, o una riga qui è di troppo.
          </Alert>
        )}

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
          {vendite.length === 0 && <Alert severity="info">Nessun incasso registrato oggi. Gli ordini ancora aperti non compaiono qui.</Alert>}

          {gruppi.map((gruppo) => (
            <Box
              key={gruppo.ordineId}
              sx={{ mb: 1.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flex: 1, minWidth: 0 }}
                  noWrap
                >
                  {gruppo.ordineId === SENZA_ORDINE ? "Righe senza ordine" : `Ordine ${gruppo.identificativo ?? gruppo.ordineId}`} ·{" "}
                  {formatCurrency(gruppo.totale)} €
                </Typography>

                {/* 🔴 «Storna», non «annulla»: l'annullo vale su un ordine ancora aperto e non
                    tocca nulla, lo storno disfa un incasso già dichiarato applicando il delta
                    inverso. Sono due gesti diversi e non stanno mai sullo stesso pulsante. */}
                {gruppo.ordineId !== SENZA_ORDINE && isAmministratore && (
                  <Button
                    size="small"
                    color="error"
                    startIcon={<UndoIcon />}
                    disabled={stornoInCorso}
                    onClick={() => setOrdineDaStornare(gruppo.ordineId)}
                  >
                    Storna
                  </Button>
                )}
              </Box>

              {gruppo.righe.map((vendita) => (
                <Box
                  key={vendita.venditaId}
                  sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: 1, borderColor: "divider" }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600 }}
                    >
                      {vendita.quantita > 1 ? `${vendita.quantita}× ` : ""}
                      {vendita.prodotto?.nome ?? `Prodotto ${vendita.prodottoId}`}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                      <Chip
                        size="small"
                        label={etichettaMetodo(vendita.metodoPagamento)}
                        color={METODI_PAGAMENTO.find((m) => m.valore === vendita.metodoPagamento)?.colore ?? "default"}
                        variant="outlined"
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {dayjs(vendita.dataOra).format("HH:mm")}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
                  >
                    {formatCurrency(vendita.prezzoTotale)}
                  </Typography>

                  {/* Solo le righe senza ordine restano correggibili una per una: con un ordine
                      dietro il server rifiuta entrambe le mutation, e mostrare due pulsanti che
                      danno errore sarebbe peggio che non mostrarli. */}
                  {!vendita.ordineId && (
                    <>
                      <IconButton
                        aria-label={`Cambia metodo di ${vendita.prodotto?.nome ?? "vendita"}`}
                        size="small"
                        onClick={(evento) => {
                          setAncora(evento.currentTarget);
                          setVenditaInModifica(vendita);
                        }}
                      >
                        <SwapHorizIcon fontSize="small" />
                      </IconButton>

                      <IconButton
                        aria-label={`Elimina ${vendita.prodotto?.nome ?? "vendita"}`}
                        size="small"
                        color="error"
                        onClick={() => handleElimina(vendita)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>

        <Button
          fullWidth
          onClick={onChiudi}
          sx={{ mt: 1.5, minHeight: 44 }}
        >
          Chiudi
        </Button>
      </Box>

      <Menu
        anchorEl={ancora}
        open={Boolean(ancora)}
        onClose={() => {
          setAncora(null);
          setVenditaInModifica(null);
        }}
      >
        {METODI_PAGAMENTO.map((metodo) => (
          <MenuItem
            key={metodo.valore}
            selected={venditaInModifica?.metodoPagamento === metodo.valore}
            onClick={() => handleCambiaMetodo(metodo.valore)}
            sx={{ minHeight: 48 }}
          >
            {metodo.etichetta}
          </MenuItem>
        ))}
      </Menu>

      <DialogMotivo
        aperto={Boolean(ordineDaStornare)}
        titolo="Storna l'ordine"
        spiegazione="L'incasso viene disfatto: le vendite dell'ordine spariscono e i secchi del registro tornano indietro dell'importo. Le voci battute restano, come traccia di ciò che è successo."
        suggerimenti={["Reso al cliente", "Ordine battuto due volte", "Metodo di pagamento sbagliato"]}
        etichettaConferma="Storna l'ordine"
        inCorso={stornoInCorso}
        onChiudi={() => setOrdineDaStornare(null)}
        onConferma={handleStorna}
      />
    </Drawer>
  );
}

export default ScontrinoDelGiorno;
