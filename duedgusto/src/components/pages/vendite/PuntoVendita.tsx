import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { useTheme } from "@mui/material/styles";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import { useNavigate } from "react-router";

import ChiusuraOrdine from "./ChiusuraOrdine";
import DialogMotivo from "./DialogMotivo";
import OrdineCorrente from "./OrdineCorrente";
import OrdiniAperti from "./OrdiniAperti";
import ScontrinoDelGiorno from "./ScontrinoDelGiorno";
import SplitOrdine from "./SplitOrdine";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { coloreCategoria, coloreProdotto, indiciPerCategoria } from "./coloriProdotto";
import useQueryRegistroCassa from "../../../graphql/registroCassa/useQueryRegistroCassa";
import { getProdottiVendibili, getVenditeDelRegistro } from "../../../graphql/vendite/queries";
import { getOrdine, getOrdiniAperti } from "../../../graphql/ordini/queries";
import {
  mutationAggiornaRigaOrdine,
  mutationAnnullaOrdine,
  mutationApriOrdine,
  mutationChiudiOrdine,
  mutationAggiungiRigaOrdine,
  mutationRimuoviRigaOrdine,
} from "../../../graphql/ordini/mutations";

const TUTTE = "__tutte__";

/**
 * Il punto vendita: **si compone un ordine**, e il metodo di pagamento si chiede una volta sola,
 * alla fine.
 *
 * <p>Era «due tocchi per consumazione — il prodotto, poi il metodo», ed è il cambiamento che
 * questa pagina porta: al bancone non si sa come pagheranno finché non arrivano alla cassa, e
 * chiedere il metodo a ogni birra costringeva a indovinare otto volte di fila. Ora ogni tocco
 * aggiunge una voce a un conto aperto, che non ha mosso un centesimo finché non lo si incassa.</p>
 *
 * <p>È la prima pagina del gestionale disegnata **prima per il telefono**. Niente AG Grid:
 * battere una consumazione dietro al bancone è un dito, una mano sola, uno schermo da 360 px e
 * il telefono probabilmente sporco. Una griglia di celle editabili è lo strumento sbagliato per
 * quel gesto, per quanto sia quello giusto per l'anagrafica.</p>
 */
function PuntoVendita() {
  const { setTitle } = useContext(PageTitleContext);
  const navigate = useNavigate();
  const { palette } = useTheme();

  const [categoria, setCategoria] = useState<string>(TUTTE);
  const [ricerca, setRicerca] = useState("");
  const [ordineCorrenteId, setOrdineCorrenteId] = useState<number | null>(null);
  const [vociAperte, setVociAperte] = useState(false);
  const [chiusuraAperta, setChiusuraAperta] = useState(false);
  const [splitAperto, setSplitAperto] = useState(false);
  const [annulloAperto, setAnnulloAperto] = useState(false);
  const [scontrinoAperto, setScontrinoAperto] = useState(false);
  const [elencoApertiVisibile, setElencoApertiVisibile] = useState(false);

  // 🔴 L'apertura dell'ordine è **implicita al primo tocco**, e due tocchi rapidi arrivano prima
  //    che la prima risposta torni: senza questa promessa condivisa nascerebbero due ordini, il
  //    secondo con dentro una sola voce, e nessuno se ne accorgerebbe fino alla cassa.
  const aperturaInVolo = useRef<Promise<number | null> | null>(null);

  const oggi = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const { registroCassa, loading: caricamentoRegistro, refetch: ricaricaRegistro } = useQueryRegistroCassa({ data: oggi });

  const { data: datiProdotti, loading: caricamentoProdotti } = useQuery(getProdottiVendibili, {
    variables: { limite: 500 },
    fetchPolicy: "cache-first",
  });

  const registroCassaId = registroCassa?.id ?? 0;

  const { data: datiVendite, refetch: ricaricaVendite } = useQuery(getVenditeDelRegistro, {
    variables: { registroCassaId, limite: 500 },
    skip: !registroCassaId,
    fetchPolicy: "cache-and-network",
  });

  // 🔴 Senza `registroCassaId` questa query risponderebbe con gli aperti di **tutti** i registri.
  //    Qui il registro si passa di proposito: il badge conta ciò che pesa sulla giornata che si
  //    sta battendo. L'elenco completo, ordini di ieri compresi, è l'affare di `OrdiniAperti`.
  const { data: datiAperti, refetch: ricaricaAperti } = useQuery(getOrdiniAperti, {
    variables: { registroCassaId },
    skip: !registroCassaId,
    fetchPolicy: "cache-and-network",
  });

  const { data: datiOrdine, refetch: ricaricaOrdineQuery } = useQuery(getOrdine, {
    variables: { id: ordineCorrenteId ?? 0 },
    skip: !ordineCorrenteId,
    fetchPolicy: "cache-and-network",
  });

  const [apriOrdine] = useMutation(mutationApriOrdine);
  const [aggiungiRigaOrdine, { loading: aggiuntaInCorso }] = useMutation(mutationAggiungiRigaOrdine);
  const [aggiornaRigaOrdine, { loading: aggiornamentoInCorso }] = useMutation(mutationAggiornaRigaOrdine);
  const [rimuoviRigaOrdine, { loading: rimozioneInCorso }] = useMutation(mutationRimuoviRigaOrdine);
  const [chiudiOrdine, { loading: chiusuraInCorso }] = useMutation(mutationChiudiOrdine);
  const [annullaOrdine, { loading: annullamentoInCorso }] = useMutation(mutationAnnullaOrdine);

  useEffect(() => {
    setTitle("Vendita");
  }, [setTitle]);

  const prodotti = useMemo(() => datiProdotti?.vendite?.prodotti ?? [], [datiProdotti]);
  const vendite = useMemo(() => datiVendite?.vendite?.vendite ?? [], [datiVendite]);
  const ordiniAperti = useMemo(() => datiAperti?.vendite?.ordiniAperti ?? [], [datiAperti]);

  // La risposta della query può essere ancora quella dell'ordine precedente mentre il nuovo id
  // vola: mostrarla darebbe un totale che non è di questo conto.
  const ordineCorrente = useMemo(() => {
    const letto = datiOrdine?.vendite?.ordine ?? null;
    return letto && letto.ordineId === ordineCorrenteId ? letto : null;
  }, [datiOrdine, ordineCorrenteId]);

  const categorie = useMemo(
    () => (datiProdotti?.vendite?.categorieProdotto ?? []).filter((c): c is string => Boolean(c)),
    [datiProdotti]
  );

  // Filtro in memoria: il listino sta in poche centinaia di righe, già tutte in cache. Rifare il
  // giro di rete a ogni lettera renderebbe la ricerca più lenta di quanto si scriva.
  const prodottiVisibili = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    return prodotti.filter((prodotto) => {
      const perCategoria = categoria === TUTTE || prodotto.categoria === categoria;
      const perTermine = !termine || prodotto.nome.toLowerCase().includes(termine) || prodotto.codice.toLowerCase().includes(termine);
      return perCategoria && perTermine;
    });
  }, [categoria, prodotti, ricerca]);

  // 🔴 Gli indici si calcolano sul listino INTERO, non su `prodottiVisibili`: legarli a quello
  //    che si vede farebbe cambiare colore alle tessere a ogni lettera della ricerca, e la mano
  //    ha gia imparato dov'era il pulsante.
  const indiciColore = useMemo(() => indiciPerCategoria(prodotti), [prodotti]);

  const inCorso = aggiuntaInCorso || aggiornamentoInCorso || rimozioneInCorso || chiusuraInCorso || annullamentoInCorso;

  const errore = useCallback((errore: unknown, ripiego: string, toastId: string) => {
    showToast({
      type: "error",
      position: "bottom-center",
      message: errore instanceof Error ? errore.message : ripiego,
      autoClose: 8000,
      toastId,
    });
  }, []);

  const ricaricaOrdine = useCallback(
    async (id: number) => {
      await ricaricaOrdineQuery({ id });
    },
    [ricaricaOrdineQuery]
  );

  /**
   * L'id dell'ordine su cui battere, aprendolo se non c'è.
   *
   * <p>Il ritorno è memorizzato in una `ref` e non in uno stato perché serve **prima** del
   * prossimo render: due tocchi ravvicinati devono attendere la stessa apertura, non farne
   * partire una seconda.</p>
   */
  const assicuraOrdine = useCallback(async (): Promise<number | null> => {
    if (ordineCorrenteId) {
      return ordineCorrenteId;
    }
    if (aperturaInVolo.current) {
      return aperturaInVolo.current;
    }
    const apertura = apriOrdine({ variables: { registroCassaId } })
      .then((esito) => {
        const nato = esito.data?.vendite?.apriOrdine ?? null;
        if (nato) {
          setOrdineCorrenteId(nato.ordineId);
        }
        return nato?.ordineId ?? null;
      })
      .finally(() => {
        aperturaInVolo.current = null;
      });
    aperturaInVolo.current = apertura;
    return apertura;
  }, [apriOrdine, ordineCorrenteId, registroCassaId]);

  const handleTocca = useCallback(
    async (prodotto: ProdottoVendibile) => {
      if (!registroCassaId) {
        return;
      }
      try {
        const ordineId = await assicuraOrdine();
        if (!ordineId) {
          return;
        }
        // ℹ️ Quantità 1: la stessa consumazione battuta due volte diventa due righe, e lo
        //    stepper del foglio delle voci le riunisce quando serve. Chiedere la quantità a ogni
        //    tocco rimetterebbe in mezzo la domanda che questo change ha tolto.
        await aggiungiRigaOrdine({ variables: { ordineId, prodottoId: prodotto.prodottoId, quantita: 1 } });
        await Promise.all([ricaricaOrdine(ordineId), ricaricaAperti()]);
      } catch (guasto) {
        errore(guasto, "Voce non aggiunta all'ordine", "riga-errore");
      }
    },
    [aggiungiRigaOrdine, assicuraOrdine, errore, ricaricaAperti, ricaricaOrdine, registroCassaId]
  );

  const handleCambiaQuantita = useCallback(
    async (riga: RigaOrdine, quantita: number) => {
      if (quantita < 1 || !ordineCorrenteId) {
        return;
      }
      try {
        await aggiornaRigaOrdine({ variables: { rigaOrdineId: riga.rigaOrdineId, quantita } });
        await ricaricaOrdine(ordineCorrenteId);
      } catch (guasto) {
        errore(guasto, "Quantità non aggiornata", "riga-quantita-errore");
      }
    },
    [aggiornaRigaOrdine, errore, ordineCorrenteId, ricaricaOrdine]
  );

  const handleRimuoviRiga = useCallback(
    async (riga: RigaOrdine) => {
      if (!ordineCorrenteId) {
        return;
      }
      try {
        await rimuoviRigaOrdine({ variables: { rigaOrdineId: riga.rigaOrdineId } });
        await Promise.all([ricaricaOrdine(ordineCorrenteId), ricaricaAperti()]);
      } catch (guasto) {
        errore(guasto, "Voce non rimossa", "riga-rimozione-errore");
      }
    },
    [errore, ordineCorrenteId, ricaricaAperti, ricaricaOrdine, rimuoviRigaOrdine]
  );

  const handleIncassa = useCallback(
    async (tagli: TaglioOrdineInput[]) => {
      if (!ordineCorrenteId) {
        return;
      }
      try {
        const esito = await chiudiOrdine({ variables: { input: { ordineId: ordineCorrenteId, tagli } } });
        const resto = esito.data?.vendite?.chiudiOrdine?.restoDaRendere ?? 0;
        setChiusuraAperta(false);
        setSplitAperto(false);
        setVociAperte(false);
        setOrdineCorrenteId(null);
        // Il registro va riletto perché i suoi secchi sono appena cambiati: è il numero che
        // l'operatore userà per quadrare a fine giornata.
        await Promise.all([ricaricaVendite(), ricaricaRegistro(), ricaricaAperti()]);
        showToast({
          type: "success",
          position: "bottom-center",
          message: resto > 0 ? `Ordine incassato · resto da rendere ${formatCurrency(resto)} €` : "Ordine incassato",
          autoClose: 4000,
          toastId: "ordine-incassato",
        });
      } catch (guasto) {
        // 🔴 Nessun ritentativo automatico, qui: l'alimentazione dei secchi è per delta e non è
        //    idempotente. Riprovare da soli raddoppierebbe l'incasso in silenzio.
        errore(guasto, "Ordine non incassato", "ordine-incasso-errore");
      }
    },
    [chiudiOrdine, errore, ordineCorrenteId, ricaricaAperti, ricaricaRegistro, ricaricaVendite]
  );

  const handleAnnulla = useCallback(
    async (motivo: string) => {
      if (!ordineCorrenteId) {
        return;
      }
      try {
        await annullaOrdine({ variables: { ordineId: ordineCorrenteId, motivo } });
        setAnnulloAperto(false);
        setVociAperte(false);
        setOrdineCorrenteId(null);
        await ricaricaAperti();
        showToast({ type: "success", position: "bottom-center", message: "Ordine annullato", autoClose: 2500, toastId: "ordine-annullato" });
      } catch (guasto) {
        errore(guasto, "Annullamento non riuscito", "ordine-annullo-errore");
      }
    },
    [annullaOrdine, errore, ordineCorrenteId, ricaricaAperti]
  );

  const handleRiprendi = useCallback(
    (ordine: Ordine) => {
      setOrdineCorrenteId(ordine.ordineId);
      setElencoApertiVisibile(false);
      void ricaricaOrdine(ordine.ordineId);
    },
    [ricaricaOrdine]
  );

  if (caricamentoRegistro) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // 🔴 Lo stato «cassa non aperta» si gestisce PRIMA di mostrare la griglia, non al primo tocco.
  //    `registroCassa(data)` restituisce null quando il registro del giorno non esiste, e
  //    `apriOrdine` pretende un registro: lasciar battere per poi rifiutare farebbe perdere
  //    l'ordinazione. E il registro NON si crea al volo da qui — nasce con i conteggi di
  //    apertura, che sono un gesto di cassa, non un effetto collaterale di una birra.
  if (!registroCassa) {
    return (
      <Box sx={{ p: 2, maxWidth: 560, mx: "auto" }}>
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
        >
          <AlertTitle>La cassa di oggi non è ancora aperta</AlertTitle>
          Gli ordini si agganciano al registro del giorno, e quello di {dayjs(oggi).format("DD/MM/YYYY")} non esiste ancora. Va aperto con i conteggi di apertura prima di
          battere.
        </Alert>
        <Button
          fullWidth
          variant="contained"
          size="large"
          sx={{ minHeight: 48 }}
          onClick={() => navigate("/gestionale/cassa/details")}
        >
          Apri la cassa di oggi
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)" }}>
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Cerca prodotto o codice"
          value={ricerca}
          onChange={(evento) => setRicerca(evento.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Chip scorrevoli in orizzontale: a 360 px dieci categorie non ci stanno, e mandarle a
            capo mangerebbe metà schermo alla griglia. */}
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5, mt: 1, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          <Chip
            label="Tutti"
            color={categoria === TUTTE ? "primary" : "default"}
            onClick={() => setCategoria(TUTTE)}
            sx={{ flexShrink: 0 }}
          />
          {categorie.map((nome) => (
            <Chip
              key={nome}
              label={nome}
              color={categoria === nome ? "primary" : "default"}
              onClick={() => setCategoria(nome)}
              // Il pallino è dove si impara l'associazione categoria→tinta, prima ancora di
              // guardare la griglia. L'anello lo tiene visibile anche sul chip selezionato, che
              // è ambra e altrimenti si mangerebbe le brioches.
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: coloreCategoria(nome, palette.mode),
                    boxShadow: palette.mode === "light" ? "0 0 0 1px rgba(0, 0, 0, 0.25)" : "0 0 0 1px rgba(255, 255, 255, 0.3)",
                  }}
                />
              }
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 1.5, pb: 1 }}>
        {caricamentoProdotti && prodotti.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!caricamentoProdotti && prodottiVisibili.length === 0 && (
          <Alert severity="info">Nessun prodotto attivo corrisponde. Il listino si cura in Cassa › Prodotti.</Alert>
        )}

        {/* Due colonne a 360 px, tre a 390, quattro da tablet: `auto-fill` con una base di
            150 px lo fa da sé, senza breakpoint da tenere allineati a mano. */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1 }}>
          {prodottiVisibili.map((prodotto) => {
            const colore = coloreProdotto(prodotto.categoria, indiciColore.get(prodotto.prodottoId) ?? 0, palette.mode);
            return (
              <ButtonBase
                key={prodotto.prodottoId}
                onClick={() => void handleTocca(prodotto)}
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
                  // Al tocco vale la deformazione, non il colore: sul telefono l'hover non esiste
                  // e schiarire uno sfondo già tenue non si vedrebbe comunque.
                  "&:active": { transform: "scale(0.97)" },
                  "&:hover": { filter: palette.mode === "light" ? "brightness(0.96)" : "brightness(1.12)" },
                  // Chi ha chiesto meno movimento al sistema operativo non deve vederne qui.
                  "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:active": { transform: "none" } },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {prodotto.nome}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatCurrency(prodotto.prezzo)}
                </Typography>
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* Barra fissa in basso, sotto il pollice: **il conto aperto**, non più il battuto del
          giorno. Il totale del giorno resta a un tocco di distanza, nello scontrino, ma il
          numero che serve mentre si batte è quello che il cliente sta per pagare. */}
      <Paper
        elevation={3}
        square
        sx={{ flexShrink: 0, px: 1.5, py: 1, display: "flex", flexDirection: "column", gap: 1 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ButtonBase
            onClick={() => setVociAperte(true)}
            disabled={!ordineCorrente || ordineCorrente.righe.length === 0}
            sx={{ minWidth: 0, flex: 1, justifyContent: "flex-start", textAlign: "left", borderRadius: 1, px: 0.5, py: 0.5, minHeight: 48 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                noWrap
              >
                {/* 🔴 L'identificativo si vede da subito, e non solo in stampa: la numerazione è
                    per registro e vedere il numero salire è ciò che fa notare un duplicato la
                    sera stessa, invece che a fine mese. */}
                {ordineCorrente
                  ? `Ordine ${ordineCorrente.identificativo} · ${ordineCorrente.righe.length} ${ordineCorrente.righe.length === 1 ? "voce" : "voci"}`
                  : "Nessun ordine aperto"}
              </Typography>
              <Typography
                variant="h6"
                sx={{ lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}
              >
                {ordineCorrente ? `${formatCurrency(ordineCorrente.totaleCorrente)} €` : "Tocca un prodotto per iniziare"}
              </Typography>
            </Box>
          </ButtonBase>

          <IconButton
            aria-label="Ordini aperti"
            onClick={() => setElencoApertiVisibile(true)}
            sx={{ width: 48, height: 48 }}
          >
            <Badge
              badgeContent={ordiniAperti.length}
              color="warning"
              max={99}
            >
              <PendingActionsIcon />
            </Badge>
          </IconButton>

          <IconButton
            aria-label="Scontrino del giorno"
            onClick={() => setScontrinoAperto(true)}
            sx={{ width: 48, height: 48 }}
          >
            <Badge
              badgeContent={vendite.length}
              color="error"
              max={999}
            >
              <ReceiptLongIcon />
            </Badge>
          </IconButton>
        </Box>

        {ordineCorrente && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              color="error"
              disabled={inCorso}
              onClick={() => setAnnulloAperto(true)}
              sx={{ minHeight: 56, flex: 1 }}
            >
              Annulla ordine
            </Button>
            <Button
              variant="contained"
              disabled={inCorso || ordineCorrente.righe.length === 0}
              onClick={() => setChiusuraAperta(true)}
              sx={{ minHeight: 56, flex: 1.6 }}
            >
              Chiudi ordine
            </Button>
          </Box>
        )}
      </Paper>

      <OrdineCorrente
        aperto={vociAperte}
        ordine={ordineCorrente}
        inCorso={inCorso}
        onChiudi={() => setVociAperte(false)}
        onCambiaQuantita={(riga, quantita) => void handleCambiaQuantita(riga, quantita)}
        onRimuovi={(riga) => void handleRimuoviRiga(riga)}
        onIncassa={() => {
          setVociAperte(false);
          setChiusuraAperta(true);
        }}
      />

      <ChiusuraOrdine
        ordine={chiusuraAperta ? ordineCorrente : null}
        inCorso={chiusuraInCorso}
        onChiudi={() => setChiusuraAperta(false)}
        onConferma={(tagli) => void handleIncassa(tagli)}
        onDividi={() => {
          setChiusuraAperta(false);
          setSplitAperto(true);
        }}
      />

      <SplitOrdine
        aperto={splitAperto}
        ordine={ordineCorrente}
        inCorso={chiusuraInCorso}
        onChiudi={() => setSplitAperto(false)}
        onConferma={(tagli) => void handleIncassa(tagli)}
      />

      <OrdiniAperti
        aperto={elencoApertiVisibile}
        onChiudi={() => setElencoApertiVisibile(false)}
        onRiprendi={handleRiprendi}
        onRisolto={async () => {
          await Promise.all([ricaricaAperti(), ricaricaVendite(), ricaricaRegistro()]);
        }}
      />

      <DialogMotivo
        aperto={annulloAperto}
        titolo={`Annulla l'ordine ${ordineCorrente?.identificativo ?? ""}`}
        spiegazione="L'ordine non sparisce e resta consultabile: nessun incasso viene toccato, perché non ne è mai stato dichiarato uno."
        suggerimenti={["Cliente andato via", "Ordine battuto due volte", "Errore di battitura"]}
        etichettaConferma="Annulla l'ordine"
        inCorso={annullamentoInCorso}
        onChiudi={() => setAnnulloAperto(false)}
        onConferma={(motivo) => void handleAnnulla(motivo)}
      />

      <ScontrinoDelGiorno
        aperto={scontrinoAperto}
        vendite={vendite}
        registroCassa={registroCassa}
        onChiudi={() => setScontrinoAperto(false)}
        onModificato={async () => {
          await Promise.all([ricaricaVendite(), ricaricaRegistro(), ricaricaAperti()]);
        }}
      />
    </Box>
  );
}

export default PuntoVendita;
