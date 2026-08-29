import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";

import formatCurrency from "../../../common/bones/formatCurrency";
import { coloreCategoria, coloreProdotto, indiciPerCategoria } from "./coloriProdotto";

interface ComposizioneGruppoProps {
  /** Gli id dei membri **nell'ordine in cui devono comparire**: la posizione È l'ordinamento. */
  membri: readonly number[];
  prodotti: readonly ProdottoVendibile[];
  categorie: readonly string[];
  onAggiungi: (prodottoId: number) => void;
  onTogli: (prodottoId: number) => void;
  onSposta: (prodottoId: number, verso: -1 | 1) => void;
}

/**
 * La composizione di un gruppo: **due liste che si scambiano le voci**.
 *
 * <p>🔴 <b>Perché non è più una griglia dati con una spunta.</b> La versione precedente metteva
 * l'unico modo di aggiungere un prodotto dentro una colonna di AG Grid, come un contrassegno
 * «Sì/No» che sembrava uno stato e non un pulsante. In produzione è finita come doveva finire:
 * un gruppo «Spritz» creato, salvato due volte e rimasto vuoto. Qui l'aggiunta è un gesto con un
 * esito visibile — la voce sparisce da destra e compare a sinistra — e chi compone vede in ogni
 * momento cosa c'è dentro senza dover riscorrere centoventi righe.</p>
 *
 * <p>🔴 <b>L'ordine è la posizione nella lista</b>, non un numero scritto in una cella. Un campo
 * numerico libero permette due membri con lo stesso ordine e un ordine con un buco in mezzo:
 * stati che il banco deve poi risolvere da sé, arbitrariamente. Qui non sono rappresentabili.</p>
 *
 * <p>⚠️ <b>Chi è già dentro non compare a listino.</b> Non è cosmesi: la stessa coppia
 * (gruppo, prodotto) è la chiave composita di <c>ProdottiGruppi</c>, e un secondo inserimento
 * tornerebbe come errore del server invece che come nulla di fatto.</p>
 */
function ComposizioneGruppo({ membri, prodotti, categorie, onAggiungi, onTogli, onSposta }: ComposizioneGruppoProps) {
  const { palette } = useTheme();
  const [ricerca, setRicerca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);

  const perId = useMemo(() => new Map(prodotti.map((prodotto) => [prodotto.prodottoId, prodotto])), [prodotti]);

  // 🔴 Gli indici si prendono sul listino INTERO e non su quello filtrato: legarli a ciò che si
  //    vede farebbe cambiare colore alle voci a ogni lettera digitata nella ricerca.
  const indici = useMemo(() => indiciPerCategoria(prodotti), [prodotti]);

  const dentro = useMemo(() => new Set(membri), [membri]);

  const bandaDi = (prodotto: ProdottoVendibile) =>
    coloreProdotto(prodotto.categoria, indici.get(prodotto.prodottoId) ?? 0, palette.mode, prodotto.colore).banda;

  const disponibili = useMemo(() => {
    const cercato = ricerca.trim().toLowerCase();
    return prodotti.filter((prodotto) => {
      if (dentro.has(prodotto.prodottoId)) {
        return false;
      }
      if (categoria && (prodotto.categoria ?? "") !== categoria) {
        return false;
      }
      if (!cercato) {
        return true;
      }
      return prodotto.nome.toLowerCase().includes(cercato) || prodotto.codice.toLowerCase().includes(cercato);
    });
  }, [categoria, dentro, prodotti, ricerca]);

  const intestazione = (titolo: string, quanti: number, aiuto: string) => (
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          fontWeight={600}
        >
          {titolo}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
        >
          {aiuto}
        </Typography>
      </Box>
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label={quanti}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2.5,
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* ── Nel gruppo ────────────────────────────────────────────────────────────────────── */}
      <Paper
        component="section"
        variant="outlined"
        aria-label={`Nel gruppo (${membri.length})`}
        sx={{ p: 2.5, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}
      >
        {intestazione("Nel gruppo", membri.length, "Il primo della lista è il primo tastone dentro il gruppo.")}

        {membri.length === 0 ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
            >
              Ancora vuoto. Aggiungi le varianti dal listino qui accanto: un tocco su «+» e compaiono qui.
            </Typography>
          </Box>
        ) : (
          <List
            dense
            disablePadding
            sx={{ flex: 1, overflow: "auto", minHeight: 0 }}
          >
            {membri.map((prodottoId, posizione) => {
              const prodotto = perId.get(prodottoId);
              const nome = prodotto?.nome ?? `Prodotto #${prodottoId}`;
              return (
                <ListItem
                  key={prodottoId}
                  disableGutters
                  sx={{
                    gap: 1,
                    py: 0.75,
                    borderBottom: 1,
                    borderColor: "divider",
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                  secondaryAction={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <IconButton
                        size="small"
                        aria-label={`Sposta su ${nome}`}
                        disabled={posizione === 0}
                        onClick={() => onSposta(prodottoId, -1)}
                      >
                        <KeyboardArrowUpIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Sposta giù ${nome}`}
                        disabled={posizione === membri.length - 1}
                        onClick={() => onSposta(prodottoId, 1)}
                      >
                        <KeyboardArrowDownIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Togli ${nome} dal gruppo`}
                        onClick={() => onTogli(prodottoId)}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  {/* La posizione si vede, perché è il dato che si sta modificando: nasconderla
                      renderebbe il riordino un'azione senza riscontro. */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ width: 18, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}
                  >
                    {posizione + 1}
                  </Typography>
                  <Box
                    sx={{
                      width: 4,
                      alignSelf: "stretch",
                      borderRadius: 1,
                      flexShrink: 0,
                      bgcolor: prodotto ? bandaDi(prodotto) : "divider",
                    }}
                  />
                  <ListItemText
                    primary={nome}
                    secondary={prodotto ? `${prodotto.categoria ?? "senza categoria"} · ${formatCurrency(prodotto.prezzo)} €` : "non più a listino"}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { variant: "caption" },
                    }}
                    sx={{ my: 0, pr: 11, minWidth: 0 }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>

      {/* ── Il listino ────────────────────────────────────────────────────────────────────── */}
      <Paper
        component="section"
        variant="outlined"
        aria-label={`Listino (${disponibili.length})`}
        sx={{ p: 2.5, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}
      >
        {intestazione("Listino", disponibili.length, "Le voci che puoi ancora aggiungere a questo gruppo.")}

        <TextField
          size="small"
          fullWidth
          label="Cerca un prodotto"
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
          sx={{ mb: 1 }}
        />

        {categorie.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
            <Chip
              size="small"
              label="Tutte"
              variant={categoria === null ? "filled" : "outlined"}
              onClick={() => setCategoria(null)}
            />
            {categorie.map((nome) => (
              <Chip
                key={nome}
                size="small"
                label={nome}
                variant={categoria === nome ? "filled" : "outlined"}
                onClick={() => setCategoria(categoria === nome ? null : nome)}
                // Il pallino insegna l'associazione categoria→tinta, la stessa che al banco
                // distingue le tessere: qui la si rivede mentre si compone.
                icon={
                  <Box
                    component="span"
                    sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: coloreCategoria(nome, palette.mode), ml: 1 }}
                  />
                }
              />
            ))}
          </Box>
        )}

        {disponibili.length === 0 ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
            >
              Nessun prodotto da aggiungere con questi filtri.
            </Typography>
          </Box>
        ) : (
          <List
            dense
            disablePadding
            sx={{ flex: 1, overflow: "auto", minHeight: 0 }}
          >
            {disponibili.map((prodotto) => (
              <ListItem
                key={prodotto.prodottoId}
                disableGutters
                disablePadding
                sx={{ borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
              >
                <ListItemButton
                  aria-label={`Aggiungi ${prodotto.nome} al gruppo`}
                  onClick={() => onAggiungi(prodotto.prodottoId)}
                  sx={{ gap: 1, py: 0.75, px: 0.5, minWidth: 0 }}
                >
                  <AddIcon
                    fontSize="small"
                    color="action"
                  />
                  <Box
                    sx={{ width: 4, alignSelf: "stretch", borderRadius: 1, flexShrink: 0, bgcolor: bandaDi(prodotto) }}
                  />
                  <ListItemText
                    primary={prodotto.nome}
                    secondary={`${prodotto.categoria ?? "senza categoria"} · ${formatCurrency(prodotto.prezzo)} €`}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { variant: "caption" },
                    }}
                    sx={{ my: 0, minWidth: 0 }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}

export default ComposizioneGruppo;
