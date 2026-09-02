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
import PostAddIcon from "@mui/icons-material/PostAdd";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router";

import ChiusuraOrdine from "./ChiusuraOrdine";
import DialogMotivo from "./DialogMotivo";
import OrdineCorrente from "./OrdineCorrente";
import OrdiniAperti from "./OrdiniAperti";
import ScontrinoDelGiorno from "./ScontrinoDelGiorno";
import TesseraProdotto from "./TesseraProdotto";
import VariantiGruppo from "./VariantiGruppo";
import SplitOrdine from "./SplitOrdine";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { coloreCategoria, coloreProdotto, indiciPerCategoria } from "./coloriProdotto";
import useQueryRegistroCassa from "../../../graphql/registroCassa/useQueryRegistroCassa";
import { getProdottiVendibili, getVenditeDelRegistro } from "../../../graphql/vendite/queries";
import { getOrdine, getOrdiniAperti } from "../../../graphql/ordini/queries";
import { getGruppiProdotti } from "../../../graphql/gruppi/queries";
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
  const location = useLocation();
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
  const [gruppoAperto, setGruppoAperto] = useState<GruppoProdotti | null>(null);

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
  // I gruppi e i prodotti sciolti arrivano insieme: sono le due metà di ciò che la griglia
  // disegna, e chiederli separatamente aprirebbe una finestra in cui un prodotto compare due
  // volte — sotto il suo tastone e fra gli sciolti — o sparisce da entrambe.
  const { data: datiGruppi } = useQuery(getGruppiProdotti, { fetchPolicy: "cache-and-network" });

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

  const gruppi = useMemo(() => datiGruppi?.vendite?.gruppiProdotti ?? [], [datiGruppi]);

  /**
   * I tastoni di gruppo da mostrare, filtrati come le tessere.
   *
   * 🔴 **Con una ricerca in corso i gruppi si sciolgono**, e non è una scorciatoia: chi digita
   *    «campari» sta cercando *quella* variante, e un tastone «Spritz» che la contiene non è una
   *    risposta — costringerebbe a un tocco in più proprio nel gesto che serviva a fare prima.
   *    Sotto ricerca la griglia torna a essere il listino piatto di sempre.
   *
   * ⚠️ Il filtro per categoria guarda i **membri**, non il gruppo: un gruppo non ha una categoria
   *    propria — è il livello sopra, e le sue varianti possono stare in categorie diverse.
   */
  const gruppiVisibili = useMemo(() => {
    if (ricerca.trim()) {
      return [];
    }
    // 🔴 Un gruppo senza varianti battibili non va al banco. `prezzoMinimo` è nullo esattamente
    //    quando nessun membro è attivo — è il criterio del server, non un conteggio nostro — e
    //    un tastone in quello stato è un pulsante morto: si preme, si apre un cassetto vuoto, e
    //    l'unica uscita è chiuderlo. Capita davvero, perché un gruppo si crea prima di
    //    riempirlo, e capita anche quando l'ultima variante viene disattivata dal listino.
    const componibili = gruppi.filter((gruppo) => gruppo.prezzoMinimo != null);
    if (categoria === TUTTE) {
      return componibili;
    }
    return componibili.filter((gruppo) => gruppo.membri.some((membro) => membro.prodotto?.categoria === categoria));
  }, [categoria, gruppi, ricerca]);

  /**
   * Le tessere sciolte: i prodotti che nessun gruppo attivo ha preso.
   *
   * ⚠️ Finché i gruppi non arrivano — o se non ne esiste nessuno — si mostra il listino intero,
   *    che è il comportamento di prima della feature. Un elenco vuoto in attesa della risposta
   *    farebbe lampeggiare una griglia deserta a ogni apertura della pagina.
   */
  const scioltiVisibili = useMemo(() => {
    if (ricerca.trim() || gruppi.length === 0) {
      return prodottiVisibili;
    }
    const raggruppati = new Set(gruppi.flatMap((gruppo) => gruppo.membri.map((membro) => membro.prodottoId)));
    return prodottiVisibili.filter((prodotto) => !raggruppati.has(prodotto.prodottoId));
  }, [gruppi, prodottiVisibili, ricerca]);

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

  /**
   * Mette da parte l'ordine in corso e lascia che il tocco successivo ne apra un altro.
   *
   * <p>🔴 <b>Perché azzerare basta.</b> `assicuraOrdine` apre un ordine nuovo solo quando non
   * ce n'è uno corrente: riportare `ordineCorrenteId` a `null` è quindi tutto ciò che serve, e
   * il gesto riusa la stessa apertura implicita del primo tocco invece di duplicarne una
   * seconda che potrebbe divergerne.</p>
   *
   * <p>⚠️ L'ordine lasciato indietro <b>non viene toccato</b>: resta aperto con le sue voci e
   * si ritrova nell'elenco. Mettere da parte non è né chiudere né annullare, ed è l'unica delle
   * tre uscite che non muove un centesimo.</p>
   *
   * <p>⚠️ `aperturaInVolo` non si azzera: serve a far attendere due tocchi ravvicinati sulla
   * <b>stessa</b> apertura, e pulirla qui farebbe nascere due ordini per un tocco solo. Il
   * pulsante compare comunque solo con un ordine corrente già caricato, cioè quando nessuna
   * apertura è più in volo.</p>
   */
  const handleNuovoOrdine = useCallback(() => {
    setOrdineCorrenteId(null);
    // Il passaggio si vede nella barra, che torna a «Nessun ordine aperto». Il toast dice
    // *quale* conto è stato messo da parte: senza il numero, «un altro ordine» non aiuta a
    // ritrovarlo fra due minuti.
    showToast({
      type: "info",
      position: "bottom-center",
      message: `Ordine ${ordineCorrente?.identificativo ?? ""} messo da parte: resta aperto nell'elenco.`,
      autoClose: 3000,
    });
  }, [ordineCorrente]);

  /**
   * L'ordine scelto nella pagina «Ordini» diventa quello su cui si batte.
   *
   * <p>🔴 <b>Lo `state` si consuma subito</b>, con un `replace` che lo toglie dalla cronologia.
   * Senza, un ritorno indietro nel browser rimetterebbe la pagina su quell'ordine anche dopo
   * averne aperto un altro — e il tocco successivo finirebbe sul conto sbagliato, che è il
   * guasto che non lascia traccia.</p>
   */
  useEffect(() => {
    const scelto = (location.state as { ordineDaRiprendere?: number } | null)?.ordineDaRiprendere;
    if (!scelto) {
      return;
    }
    setOrdineCorrenteId(scelto);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(var(--app-height, 100dvh) - 64px)" }}>
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
          {/* 🔴 I tastoni di gruppo vengono PRIMA delle tessere sciolte, e restano in testa
              anche quando l'ordinamento direbbe altro: sono il gesto più corto della griglia —
              un tocco al posto di dieci tessere da cercare — e mescolarli in mezzo agli sciolti
              vanificherebbe la ragione per cui esistono. */}
          {gruppiVisibili.map((gruppo) => (
            <TesseraProdotto
              key={`gruppo-${gruppo.gruppoProdottiId}`}
              nome={gruppo.nome}
              // «da X €» quando le varianti costano diverso, il prezzo nudo quando costano
              // uguale: il «da» su un gruppo a prezzo unico promette una scelta che non c'è.
              dettaglio={
                gruppo.prezzoMinimo == null
                  ? ""
                  : gruppo.prezzoUniforme
                    ? `${formatCurrency(gruppo.prezzoMinimo)} €`
                    : `da ${formatCurrency(gruppo.prezzoMinimo)} €`
              }
              colore={coloreProdotto(gruppo.membri[0]?.prodotto?.categoria, 0, palette.mode, gruppo.colore)}
              indicatore={
                <Chip
                  size="small"
                  label={gruppo.membri.length}
                  sx={{ position: "absolute", top: 4, right: 4, height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
                />
              }
              onClick={() => setGruppoAperto(gruppo)}
            />
          ))}

          {scioltiVisibili.map((prodotto) => (
            <TesseraProdotto
              key={prodotto.prodottoId}
              nome={prodotto.nome}
              dettaglio={`${formatCurrency(prodotto.prezzo)} €`}
              colore={coloreProdotto(prodotto.categoria, indiciColore.get(prodotto.prodottoId) ?? 0, palette.mode, prodotto.colore)}
              onClick={() => void handleTocca(prodotto)}
            />
          ))}
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

          {/* Si offre solo con un conto in piedi: a pagina appena aperta il primo tocco apre
              già un ordine da sé, e un bersaglio in più a 360 px si paga in errori. */}
          {ordineCorrente && (
            <IconButton
              aria-label="Nuovo ordine"
              disabled={inCorso}
              onClick={handleNuovoOrdine}
              sx={{ width: 48, height: 48 }}
            >
              <PostAddIcon />
            </IconButton>
          )}

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

      <VariantiGruppo
        gruppo={gruppoAperto}
        onChiudi={() => setGruppoAperto(null)}
        onTocca={(prodotto) => void handleTocca(prodotto)}
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
