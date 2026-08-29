import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";

import ComposizioneGruppo from "./ComposizioneGruppo";
import SceltaColoreGruppo from "./SceltaColoreGruppo";
import TesseraProdotto from "./TesseraProdotto";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { coloreProdotto } from "./coloriProdotto";
import { getGruppiProdotti } from "../../../graphql/gruppi/queries";
import { mutationEliminaGruppoProdotti, mutationMutateGruppoProdotti } from "../../../graphql/gruppi/mutations";
import { getProdottiVendibili } from "../../../graphql/vendite/queries";

/** Il gruppo in lavorazione, prima che qualcuno prema Salva. */
interface Bozza {
  gruppoProdottiId: number | null;
  codice: string;
  /**
   * Vero appena qualcuno scrive nel campo Codice.
   *
   * ⚠️ Serve a sapere quando **smettere** di rigenerarlo dal nome: continuare a farlo
   * sovrascriverebbe una chiave scelta a mano alla lettera successiva battuta nel nome.
   */
  codiceToccato: boolean;
  nome: string;
  colore: string;
  attivo: boolean;
  /** Gli id dei membri **in ordine**: la posizione nell'elenco è l'ordinamento. */
  membri: number[];
}

const BOZZA_NUOVA: Bozza = { gruppoProdottiId: null, codice: "", codiceToccato: false, nome: "", colore: "", attivo: true, membri: [] };

const NESSUN_PRODOTTO: ProdottoVendibile[] = [];
const NESSUN_GRUPPO: GruppoProdotti[] = [];
const NESSUNA_CATEGORIA: string[] = [];

function daGruppo(gruppo: GruppoProdotti): Bozza {
  return {
    gruppoProdottiId: gruppo.gruppoProdottiId,
    codice: gruppo.codice,
    codiceToccato: true,
    nome: gruppo.nome,
    colore: gruppo.colore ?? "",
    attivo: gruppo.attivo,
    // I membri arrivano già ordinati dal server (Ordinamento, poi codice): qui la posizione
    // diventa l'unica rappresentazione dell'ordine, e i numeri di partenza si buttano via.
    membri: gruppo.membri.map((membro) => membro.prodottoId),
  };
}

/**
 * La chiave stabile ricavata dal nome mostrato.
 *
 * <p>⚠️ Si genera <b>solo alla creazione</b>. Rigenerarla anche in modifica cambierebbe la chiave
 * di un gruppo esistente ogni volta che qualcuno ne ritocca l'etichetta, che è esattamente ciò
 * che il codice esiste per evitare.</p>
 */
function codiceDaNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/**
 * La pagina dove si **compongono i gruppi**: si dà un nome a un mucchio di varianti e ci si
 * mettono dentro i prodotti.
 *
 * <p>🔴 <b>Non è più una griglia dati.</b> La prima versione metteva l'unico modo di aggiungere
 * un prodotto dentro una colonna di AG Grid, sotto forma di contrassegno «Sì/No»: sembrava uno
 * stato, non un pulsante. In produzione il gruppo «Spritz» è stato creato, salvato due volte e
 * lasciato vuoto, perché non c'era nulla che dicesse dove si aggiungono le varianti. Adesso la
 * composizione è due liste che si scambiano le voci, e ciò che il gruppo contiene si vede sempre.</p>
 *
 * <p>🔴 <b>Il salvataggio non svuota più la pagina.</b> Azzerare il form dopo Salva era il
 * secondo motivo per cui sembrava non funzionare: si premeva, tutto spariva, e il gruppo appena
 * salvato andava ritrovato nell'elenco a sinistra. Ora resta aperto dov'era.</p>
 *
 * <p>⚠️ <b>Lo stesso prodotto può stare in più gruppi</b>, e non è un errore: comparirà sotto
 * entrambi i tastoni. È la ragione per cui l'appartenenza è un molti-a-molti, e l'elenco a
 * sinistra lo dice contando le varianti invece di impedirlo.</p>
 */
function GruppiProdotti() {
  const { setTitle } = useContext(PageTitleContext);
  const { palette } = useTheme();

  /** `null` significa «nessun gruppo aperto»: la composizione non ha ancora un soggetto. */
  const [bozza, setBozza] = useState<Bozza | null>(null);
  /** Il gruppo che si sta per aprire lasciando indietro modifiche non salvate. */
  const [daConfermare, setDaConfermare] = useState<GruppoProdotti | "nuovo" | null>(null);

  useEffect(() => {
    setTitle("Gruppi di prodotti");
  }, [setTitle]);

  // ⚠️ `soloAttivi: false`: la pagina deve poter riaccendere un gruppo spento, e un gruppo che
  //    sparisce quando lo si disattiva non si riaccende più da nessuna parte.
  const { data: datiGruppi, refetch: ricaricaGruppi } = useQuery(getGruppiProdotti, {
    variables: { soloAttivi: false },
    fetchPolicy: "cache-and-network",
  });

  const { data: datiProdotti } = useQuery(getProdottiVendibili, {
    variables: { limite: 500 },
    fetchPolicy: "cache-and-network",
  });

  const [salvaGruppo, { loading: salvataggioInCorso }] = useMutation(mutationMutateGruppoProdotti);
  const [eliminaGruppo, { loading: eliminazioneInCorso }] = useMutation(mutationEliminaGruppoProdotti);

  const gruppi = useMemo(() => datiGruppi?.vendite?.gruppiProdotti ?? NESSUN_GRUPPO, [datiGruppi]);
  const prodotti = useMemo(() => datiProdotti?.vendite?.prodotti ?? NESSUN_PRODOTTO, [datiProdotti]);
  const categorie = useMemo(
    () => (datiProdotti?.vendite?.categorieProdotto ?? NESSUNA_CATEGORIA).filter((categoria): categoria is string => Boolean(categoria)),
    [datiProdotti]
  );

  const prodottiPerId = useMemo(() => new Map(prodotti.map((prodotto) => [prodotto.prodottoId, prodotto])), [prodotti]);

  /** La versione salvata del gruppo aperto, per sapere se la bozza se ne è allontanata. */
  const salvata = useMemo(() => {
    const gruppo = gruppi.find((candidato) => candidato.gruppoProdottiId === bozza?.gruppoProdottiId);
    return gruppo ? daGruppo(gruppo) : null;
  }, [bozza?.gruppoProdottiId, gruppi]);

  const sporca = useMemo(() => {
    if (!bozza) {
      return false;
    }
    if (!salvata) {
      // Un gruppo nuovo è «sporco» appena ha qualcosa dentro: prima non c'è niente da perdere.
      return Boolean(bozza.nome.trim() || bozza.codice.trim() || bozza.membri.length);
    }
    return (
      bozza.nome !== salvata.nome ||
      bozza.codice !== salvata.codice ||
      bozza.colore !== salvata.colore ||
      bozza.attivo !== salvata.attivo ||
      bozza.membri.length !== salvata.membri.length ||
      bozza.membri.some((prodottoId, indice) => prodottoId !== salvata.membri[indice])
    );
  }, [bozza, salvata]);

  const apri = useCallback(
    (destinazione: GruppoProdotti | "nuovo") => {
      setBozza(destinazione === "nuovo" ? BOZZA_NUOVA : daGruppo(destinazione));
    },
    []
  );

  const chiediDiAprire = useCallback(
    (destinazione: GruppoProdotti | "nuovo") => {
      // Ricliccare il gruppo già aperto non porta via niente: chiedere conferma lì sarebbe un
      // allarme per un'azione che non perde nulla, e insegnerebbe a rispondere senza leggere.
      if (destinazione !== "nuovo" && destinazione.gruppoProdottiId === bozza?.gruppoProdottiId) {
        return;
      }
      if (sporca) {
        setDaConfermare(destinazione);
        return;
      }
      apri(destinazione);
    },
    [apri, bozza?.gruppoProdottiId, sporca]
  );

  const aggiungiMembro = useCallback((prodottoId: number) => {
    // ⚠️ In coda e non in testa: chi aggiunge una variante non intende scavalcare quelle che ha
    //    già disposto.
    setBozza((precedente) => (precedente && !precedente.membri.includes(prodottoId) ? { ...precedente, membri: [...precedente.membri, prodottoId] } : precedente));
  }, []);

  const togliMembro = useCallback((prodottoId: number) => {
    setBozza((precedente) => (precedente ? { ...precedente, membri: precedente.membri.filter((id) => id !== prodottoId) } : precedente));
  }, []);

  const spostaMembro = useCallback((prodottoId: number, verso: -1 | 1) => {
    setBozza((precedente) => {
      if (!precedente) {
        return precedente;
      }
      const da = precedente.membri.indexOf(prodottoId);
      const a = da + verso;
      if (da < 0 || a < 0 || a >= precedente.membri.length) {
        return precedente;
      }
      const membri = [...precedente.membri];
      membri[da] = membri[a];
      membri[a] = prodottoId;
      return { ...precedente, membri };
    });
  }, []);

  const cambiaNome = useCallback((nome: string) => {
    setBozza((precedente) => {
      if (!precedente) {
        return precedente;
      }
      const rigenera = precedente.gruppoProdottiId === null && !precedente.codiceToccato;
      return { ...precedente, nome, codice: rigenera ? codiceDaNome(nome) : precedente.codice };
    });
  }, []);

  const handleSalva = useCallback(async () => {
    if (!bozza) {
      return;
    }
    try {
      const esito = await salvaGruppo({
        variables: {
          gruppo: {
            gruppoProdottiId: bozza.gruppoProdottiId,
            codice: bozza.codice.trim(),
            nome: bozza.nome.trim(),
            colore: bozza.colore.trim() || null,
            attivo: bozza.attivo,
            // 🔴 L'ordinamento si deriva dalla posizione, e parte da 1: `0` a database significa
            //    «mai ordinato», e assegnarlo al primo membro lo renderebbe indistinguibile da
            //    un membro che nessuno ha disposto.
            membri: bozza.membri.map((prodottoId, indice) => ({ prodottoId, ordinamento: indice + 1 })),
          },
        },
      });
      await ricaricaGruppi();
      // 🔴 Il gruppo resta aperto. Svuotare la pagina dopo il salvataggio è ciò che faceva
      //    credere che non fosse successo niente.
      const salvato = esito?.data?.vendite?.mutateGruppoProdotti;
      if (salvato) {
        setBozza(daGruppo(salvato));
      }
      showToast({ type: "success", position: "bottom-right", message: "Gruppo salvato", autoClose: 2500 });
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Salvataggio non riuscito",
        autoClose: 8000,
      });
    }
  }, [bozza, ricaricaGruppi, salvaGruppo]);

  const handleElimina = useCallback(async () => {
    if (!bozza?.gruppoProdottiId) {
      return;
    }
    try {
      await eliminaGruppo({ variables: { gruppoProdottiId: bozza.gruppoProdottiId } });
      await ricaricaGruppi();
      showToast({ type: "success", position: "bottom-right", message: "Gruppo sciolto: i prodotti restano nel listino", autoClose: 3500 });
      setBozza(null);
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Scioglimento non riuscito",
        autoClose: 8000,
      });
    }
  }, [bozza?.gruppoProdottiId, eliminaGruppo, ricaricaGruppi]);

  const inCorso = salvataggioInCorso || eliminazioneInCorso;
  const salvabile = Boolean(bozza && bozza.codice.trim() && bozza.nome.trim()) && !inCorso;

  /**
   * Il «da X €» dell'anteprima, calcolato **sulla bozza** e non sul gruppo salvato: il senso
   * dell'anteprima è mostrare l'effetto di ciò che si sta facendo adesso.
   */
  const prezziBozza = useMemo(
    () =>
      (bozza?.membri ?? [])
        .map((prodottoId) => prodottiPerId.get(prodottoId))
        .filter((prodotto): prodotto is ProdottoVendibile => Boolean(prodotto))
        .map((prodotto) => prodotto.prezzo),
    [bozza?.membri, prodottiPerId]
  );

  const dettaglioAnteprima = (() => {
    if (prezziBozza.length === 0) {
      return "nessuna variante";
    }
    const minimo = Math.min(...prezziBozza);
    const uniforme = minimo === Math.max(...prezziBozza);
    return uniforme ? `${formatCurrency(minimo)} €` : `da ${formatCurrency(minimo)} €`;
  })();

  const categoriaAnteprima = bozza?.membri.length ? prodottiPerId.get(bozza.membri[0])?.categoria : undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)" }}>
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 2.5, p: 2 }}>
        {/* ── I gruppi ─────────────────────────────────────────────────────────────────────── */}
        <Paper
          variant="outlined"
          sx={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <Box sx={{ p: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => chiediDiAprire("nuovo")}
            >
              Nuovo gruppo
            </Button>
          </Box>
          <Divider />
          <List
            dense
            disablePadding
            sx={{ overflow: "auto", flex: 1, minHeight: 0 }}
          >
            {gruppi.map((gruppo) => (
              <ListItemButton
                key={gruppo.gruppoProdottiId}
                selected={bozza?.gruppoProdottiId === gruppo.gruppoProdottiId}
                onClick={() => chiediDiAprire(gruppo)}
                sx={{ gap: 1.25 }}
              >
                {/* Il pallino è la stessa tinta del tastone: l'elenco si legge con la coda
                    dell'occhio, come la griglia del banco. */}
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    bgcolor: coloreProdotto(gruppo.membri[0]?.prodotto?.categoria, 0, palette.mode, gruppo.colore).banda,
                    opacity: gruppo.attivo ? 1 : 0.35,
                  }}
                />
                <ListItemText
                  primary={gruppo.nome}
                  secondary={`${gruppo.membri.length} ${gruppo.membri.length === 1 ? "variante" : "varianti"}${gruppo.attivo ? "" : " · spento"}`}
                  slotProps={{ primary: { noWrap: true }, secondary: { variant: "caption" } }}
                  sx={{ minWidth: 0 }}
                />
              </ListItemButton>
            ))}
            {gruppi.length === 0 && (
              <Box sx={{ p: 2 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Nessun gruppo ancora. Il primo si crea da «Nuovo gruppo».
                </Typography>
              </Box>
            )}
          </List>
        </Paper>

        {/* ── Il gruppo in lavorazione ─────────────────────────────────────────────────────── */}
        {!bozza ? (
          <Paper
            variant="outlined"
            sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, p: 4 }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={600}
            >
              Un tasto solo al posto di dieci
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ maxWidth: 460 }}
            >
              Un gruppo raccoglie le varianti che al banco si scelgono insieme — gli spritz, i caffè — e al punto vendita diventa un tastone
              solo. Scegli un gruppo a sinistra per modificarlo, o creane uno nuovo.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.5, minHeight: 0 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2.5, display: "flex", gap: 2.5, alignItems: "flex-start", flexWrap: "wrap" }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1, minWidth: 280 }}>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <TextField
                    size="small"
                    label="Nome del gruppo"
                    placeholder="Spritz"
                    value={bozza.nome}
                    onChange={(evento) => cambiaNome(evento.target.value)}
                    sx={{ width: 220 }}
                  />
                  <TextField
                    size="small"
                    label="Codice"
                    value={bozza.codice}
                    onChange={(evento) => setBozza((precedente) => (precedente ? { ...precedente, codice: evento.target.value, codiceToccato: true } : precedente))}
                    sx={{ width: 180 }}
                    helperText={bozza.gruppoProdottiId === null ? "Generato dal nome" : "Chiave stabile"}
                  />
                  <FormControlLabel
                    sx={{ mt: 0.5 }}
                    control={
                      <Switch
                        checked={bozza.attivo}
                        onChange={(evento) => setBozza((precedente) => (precedente ? { ...precedente, attivo: evento.target.checked } : precedente))}
                      />
                    }
                    label="Attivo al banco"
                  />
                </Box>
                <SceltaColoreGruppo
                  valore={bozza.colore}
                  onCambia={(colore) => setBozza((precedente) => (precedente ? { ...precedente, colore } : precedente))}
                />
              </Box>

              {/* 🔴 L'anteprima è la TESSERA VERA, lo stesso componente che si tocca al banco.
                  Un rettangolo d'esempio direbbe «più o meno così»; questo dice esattamente cosa
                  vedrà chi lavora, mentre lo si sta componendo.
                  ⚠️ Fuori dall'albero di accessibilità: è la ripetizione di dati che stanno già
                  nei campi qui accanto, e come pulsante non porta da nessuna parte. */}
              <Box
                aria-hidden
                sx={{ display: "flex", flexDirection: "column", gap: 0.5, width: 190 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Come appare al banco
                </Typography>
                <TesseraProdotto
                  disabled
                  nome={bozza.nome.trim() || "Senza nome"}
                  dettaglio={dettaglioAnteprima}
                  colore={coloreProdotto(categoriaAnteprima, 0, palette.mode, bozza.colore || null)}
                  indicatore={
                    <Chip
                      size="small"
                      label={bozza.membri.length}
                      sx={{ position: "absolute", top: 4, right: 4, height: 18 }}
                    />
                  }
                  onClick={() => {}}
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
                {sporca && (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label="Non salvato"
                  />
                )}
                {bozza.gruppoProdottiId !== null && (
                  <Button
                    color="error"
                    disabled={inCorso}
                    onClick={() => void handleElimina()}
                  >
                    Sciogli
                  </Button>
                )}
                <Button
                  variant="contained"
                  disabled={!salvabile}
                  onClick={() => void handleSalva()}
                >
                  Salva
                </Button>
              </Box>
            </Paper>

            <ComposizioneGruppo
              membri={bozza.membri}
              prodotti={prodotti}
              categorie={categorie}
              onAggiungi={aggiungiMembro}
              onTogli={togliMembro}
              onSposta={spostaMembro}
            />
          </Box>
        )}
      </Box>

      {/* Cambiare gruppo con modifiche aperte è il modo più facile di perdere una composizione
          appena fatta: costa un tocco chiederlo, e ne costa dieci rifarla. */}
      <Dialog
        open={daConfermare !== null}
        onClose={() => setDaConfermare(null)}
      >
        <DialogTitle>Modifiche non salvate</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Il gruppo «{bozza?.nome.trim() || "senza nome"}» ha modifiche che non hai ancora salvato. Se cambi gruppo adesso vanno perse.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDaConfermare(null)}>Resta qui</Button>
          <Button
            color="error"
            onClick={() => {
              if (daConfermare) {
                apri(daConfermare);
              }
              setDaConfermare(null);
            }}
          >
            Esci senza salvare
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GruppiProdotti;
