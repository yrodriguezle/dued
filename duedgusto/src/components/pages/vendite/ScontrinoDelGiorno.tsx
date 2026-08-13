import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
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
import dayjs from "dayjs";

import { METODI_PAGAMENTO, etichettaMetodo } from "./metodiPagamento";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { mutationAggiornaVendita, mutationEliminaVendita } from "../../../graphql/vendite/mutations";

interface ScontrinoDelGiornoProps {
  aperto: boolean;
  vendite: Vendita[];
  registroCassa: RegistroCassa;
  onChiudi: () => void;
  onModificato: () => Promise<void> | void;
}

/**
 * Lo scontrino del giorno: **l'unico posto** dove ci si accorge di aver battuto «elettronico»
 * invece di «contanti», e dove si rimedia.
 *
 * <p>Per questo il metodo è visibile su ogni riga e non nascosto in un dettaglio: un errore di
 * secchio non produce nessun sintomo — il totale battuto è identico — e si scoprirebbe solo a
 * fine mese, guardando una quadratura che non torna.</p>
 */
function ScontrinoDelGiorno({ aperto, vendite, registroCassa, onChiudi, onModificato }: ScontrinoDelGiornoProps) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const [venditaInModifica, setVenditaInModifica] = useState<Vendita | null>(null);

  const [aggiornaVendita] = useMutation(mutationAggiornaVendita);
  const [eliminaVendita] = useMutation(mutationEliminaVendita);

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
          autoClose: 6000,
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
            Itemizzato {formatCurrency(totaleItemizzato)} contro un totale vendite di {formatCurrency(registroCassa.totaleVendite ?? 0)}. La ripartizione IVA perde la riga stimata: o manca un incasso nel registro, o una riga qui è di troppo.
          </Alert>
        )}

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
          {vendite.length === 0 && <Alert severity="info">Nessuna vendita battuta oggi.</Alert>}

          {vendite.map((vendita) => (
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
    </Drawer>
  );
}

export default ScontrinoDelGiorno;
