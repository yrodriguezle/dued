import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import UndoIcon from "@mui/icons-material/Undo";
import dayjs from "dayjs";
import { useNavigate } from "react-router";

import ScontrinoDelGiorno from "./ScontrinoDelGiorno";
import SceltaMetodoPagamento from "./SceltaMetodoPagamento";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import useQueryRegistroCassa from "../../../graphql/registroCassa/useQueryRegistroCassa";
import { getProdottiVendibili, getVenditeDelRegistro } from "../../../graphql/vendite/queries";
import { mutationCreaVendita, mutationEliminaVendita } from "../../../graphql/vendite/mutations";

const TUTTE = "__tutte__";

/**
 * Il punto vendita: due tocchi per consumazione — il prodotto, poi il metodo.
 *
 * <p>È la prima pagina del gestionale disegnata **prima per il telefono**. Niente AG Grid:
 * battere una consumazione dietro al bancone è un dito, una mano sola, uno schermo da 360 px e
 * il telefono probabilmente sporco. Una griglia di celle editabili è lo strumento sbagliato per
 * quel gesto, per quanto sia quello giusto per l'anagrafica.</p>
 */
function PuntoVendita() {
  const { setTitle } = useContext(PageTitleContext);
  const navigate = useNavigate();

  const [categoria, setCategoria] = useState<string>(TUTTE);
  const [ricerca, setRicerca] = useState("");
  const [prodottoScelto, setProdottoScelto] = useState<ProdottoVendibile | null>(null);
  const [scontrinoAperto, setScontrinoAperto] = useState(false);
  const [ultimaVenditaId, setUltimaVenditaId] = useState<number | null>(null);

  const oggi = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const { registroCassa, loading: caricamentoRegistro, refetch: ricaricaRegistro } = useQueryRegistroCassa({ data: oggi });

  const { data: datiProdotti, loading: caricamentoProdotti } = useQuery(getProdottiVendibili, {
    variables: { limite: 500 },
    fetchPolicy: "cache-first",
  });

  const registroCassaId = registroCassa?.id ?? 0;

  const {
    data: datiVendite,
    refetch: ricaricaVendite,
  } = useQuery(getVenditeDelRegistro, {
    variables: { registroCassaId, limite: 500 },
    skip: !registroCassaId,
    fetchPolicy: "cache-and-network",
  });

  const [creaVendita, { loading: venditaInCorso }] = useMutation(mutationCreaVendita);
  const [eliminaVendita, { loading: eliminazioneInCorso }] = useMutation(mutationEliminaVendita);

  useEffect(() => {
    setTitle("Vendita");
  }, [setTitle]);

  const prodotti = useMemo(() => datiProdotti?.vendite?.prodotti ?? [], [datiProdotti]);
  const vendite = useMemo(() => datiVendite?.vendite?.vendite ?? [], [datiVendite]);

  const categorie = useMemo(
    () => (datiProdotti?.vendite?.categorieProdotto ?? []).filter((c): c is string => Boolean(c)),
    [datiProdotti]
  );

  // Filtro in memoria: il listino sta in 122 righe, già tutte in cache. Rifare il giro di rete
  // a ogni lettera renderebbe la ricerca più lenta di quanto si scriva.
  const prodottiVisibili = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    return prodotti.filter((prodotto) => {
      const perCategoria = categoria === TUTTE || prodotto.categoria === categoria;
      const perTermine = !termine || prodotto.nome.toLowerCase().includes(termine) || prodotto.codice.toLowerCase().includes(termine);
      return perCategoria && perTermine;
    });
  }, [categoria, prodotti, ricerca]);

  const totaleBattuto = useMemo(() => vendite.reduce((somma, vendita) => somma + vendita.prezzoTotale, 0), [vendite]);

  const handleConferma = useCallback(
    async (metodo: MetodoPagamentoVendita, quantita: number) => {
      if (!prodottoScelto || !registroCassaId) {
        return;
      }
      try {
        const esito = await creaVendita({
          variables: {
            input: {
              registroCassaId,
              prodottoId: prodottoScelto.prodottoId,
              quantita,
              metodoPagamento: metodo,
            },
          },
        });
        const creata = esito.data?.vendite?.creaVendita;
        setProdottoScelto(null);
        if (creata) {
          setUltimaVenditaId(creata.venditaId);
        }
        // Il registro va riletto perché i suoi secchi sono appena cambiati: è il numero che
        // l'operatore userà per quadrare a fine giornata.
        await Promise.all([ricaricaVendite(), ricaricaRegistro()]);
      } catch (errore) {
        // 🔴 Nessun ritentativo automatico, qui: l'alimentazione dei secchi è per delta e non è
        //    idempotente. Riprovare da soli raddoppierebbe l'incasso in silenzio.
        showToast({
          type: "error",
          position: "bottom-center",
          message: errore instanceof Error ? errore.message : "Vendita non registrata",
          autoClose: 6000,
          toastId: "vendita-errore",
        });
      }
    },
    [creaVendita, prodottoScelto, registroCassaId, ricaricaRegistro, ricaricaVendite]
  );

  const handleAnnullaUltima = useCallback(async () => {
    if (!ultimaVenditaId) {
      return;
    }
    try {
      await eliminaVendita({ variables: { id: ultimaVenditaId } });
      setUltimaVenditaId(null);
      await Promise.all([ricaricaVendite(), ricaricaRegistro()]);
      showToast({ type: "success", position: "bottom-center", message: "Ultima vendita annullata", autoClose: 2500, toastId: "vendita-annullata" });
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-center",
        message: errore instanceof Error ? errore.message : "Annullamento non riuscito",
        autoClose: 6000,
        toastId: "vendita-annulla-errore",
      });
    }
  }, [eliminaVendita, ricaricaRegistro, ricaricaVendite, ultimaVenditaId]);

  if (caricamentoRegistro) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // 🔴 Lo stato «cassa non aperta» si gestisce PRIMA di mostrare la griglia, non alla conferma.
  //    `registroCassa(data)` restituisce null quando il registro del giorno non esiste, e
  //    `creaVendita` pretende un registro: lasciar battere per poi rifiutare farebbe perdere
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
          Le vendite si agganciano al registro del giorno, e quello di {dayjs(oggi).format("DD/MM/YYYY")} non esiste ancora. Va aperto con i conteggi di apertura prima di battere.
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
          {prodottiVisibili.map((prodotto) => (
            <ButtonBase
              key={prodotto.prodottoId}
              onClick={() => setProdottoScelto(prodotto)}
              sx={{
                // ⚠️ 72 px: molto sopra i 48 minimi. Si preme al volo, di sbieco, senza guardare.
                minHeight: 72,
                p: 1,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "space-between",
                textAlign: "left",
                "&:hover": { bgcolor: "action.hover" },
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
          ))}
        </Box>
      </Box>

      {/* Barra fissa in basso, sotto il pollice: quanto è stato battuto, quante righe, e la via
          d'uscita dall'errore appena fatto. */}
      <Paper
        elevation={3}
        square
        sx={{ flexShrink: 0, px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
          >
            Battuto oggi
          </Typography>
          <Typography
            variant="h6"
            sx={{ lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}
          >
            {formatCurrency(totaleBattuto)}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="inherit"
          startIcon={<UndoIcon />}
          disabled={!ultimaVenditaId || eliminazioneInCorso}
          onClick={handleAnnullaUltima}
          sx={{ minHeight: 48 }}
        >
          Annulla
        </Button>

        <Button
          variant="contained"
          startIcon={
            <Badge
              badgeContent={vendite.length}
              color="error"
              max={999}
            >
              <ReceiptLongIcon />
            </Badge>
          }
          onClick={() => setScontrinoAperto(true)}
          sx={{ minHeight: 48 }}
        >
          Scontrino
        </Button>
      </Paper>

      <SceltaMetodoPagamento
        prodotto={prodottoScelto}
        inCorso={venditaInCorso}
        onChiudi={() => setProdottoScelto(null)}
        onConferma={handleConferma}
      />

      <ScontrinoDelGiorno
        aperto={scontrinoAperto}
        vendite={vendite}
        registroCassa={registroCassa}
        onChiudi={() => setScontrinoAperto(false)}
        onModificato={async () => {
          await Promise.all([ricaricaVendite(), ricaricaRegistro()]);
        }}
      />
    </Box>
  );
}

export default PuntoVendita;
