import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { GridApi, GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { getGruppiProdotti } from "../../../graphql/gruppi/queries";
import { mutationEliminaGruppoProdotti, mutationMutateGruppoProdotti } from "../../../graphql/gruppi/mutations";
import { getProdottiVendibili } from "../../../graphql/vendite/queries";

/** La riga della griglia: un prodotto più il posto che occupa nel gruppo in lavorazione. */
interface RigaProdotto extends Record<string, unknown> {
  prodottoId: number;
  codice: string;
  nome: string;
  categoria: string;
  prezzo: string;
  ordine: number;
}

/** Il gruppo in lavorazione, prima che qualcuno prema Salva. */
interface Bozza {
  gruppoProdottiId: number | null;
  codice: string;
  nome: string;
  colore: string;
  attivo: boolean;
  membri: Map<number, number>;
}

const BOZZA_VUOTA: Bozza = { gruppoProdottiId: null, codice: "", nome: "", colore: "", attivo: true, membri: new Map() };

/**
 * La pagina dove si **creano i gruppi e ci si mettono dentro i prodotti**.
 *
 * <p>🔴 <b>Qui AG Grid sì</b>, al contrario del bancone. È anagrafica: si cerca fra centoquaranta
 * voci, si ordina, si spunta. Il vincolo dei 360 px e della mano sola vale al banco, dove si
 * batte — non qui, dove si configura una volta ogni tanto seduti.</p>
 *
 * <p>🔴 <b>Il raggruppamento è libero</b>: non per prezzo, non per categoria. Un gruppo è un
 * livello sopra i prodotti e serve proprio a tagliare di traverso — le varianti di uno spritz
 * stanno in categorie e prezzi diversi e restano lo stesso gesto al banco.</p>
 *
 * <p>⚠️ <b>Lo stesso prodotto può stare in più gruppi, e non è un errore da segnalare.</b>
 * Comparirà sotto entrambi i tastoni: è la ragione per cui l'appartenenza è un molti-a-molti.
 * La griglia lo dice con un contrassegno invece di impedirlo.</p>
 *
 * <p>⚠️ <b>L'ordine è per gruppo</b>, non per prodotto: la colonna «Ordine» scrive
 * sull'appartenenza, e lo stesso spritz può essere il primo qui e il terzo altrove.</p>
 */
function GruppiProdotti() {
  const { setTitle } = useContext(PageTitleContext);
  const gridApiRef = useRef<GridApi<DatagridData<RigaProdotto>> | null>(null);
  const [bozza, setBozza] = useState<Bozza>(BOZZA_VUOTA);

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

  const gruppi = useMemo(() => datiGruppi?.vendite?.gruppiProdotti ?? [], [datiGruppi]);
  const prodotti = useMemo(() => datiProdotti?.vendite?.prodotti ?? [], [datiProdotti]);

  /** Quante appartenenze ha ogni prodotto, per il contrassegno «in più gruppi». */
  const appartenenze = useMemo(() => {
    const conteggi = new Map<number, number>();
    gruppi.forEach((gruppo) => gruppo.membri.forEach((membro) => conteggi.set(membro.prodottoId, (conteggi.get(membro.prodottoId) ?? 0) + 1)));
    return conteggi;
  }, [gruppi]);

  const righe = useMemo<RigaProdotto[]>(
    () =>
      prodotti.map((prodotto) => ({
        prodottoId: prodotto.prodottoId,
        codice: prodotto.codice,
        nome: prodotto.nome,
        categoria: prodotto.categoria ?? "",
        prezzo: `${formatCurrency(prodotto.prezzo)} €`,
        ordine: bozza.membri.get(prodotto.prodottoId) ?? 0,
      })),
    [bozza.membri, prodotti]
  );

  const apriGruppo = useCallback((gruppo: GruppoProdotti) => {
    setBozza({
      gruppoProdottiId: gruppo.gruppoProdottiId,
      codice: gruppo.codice,
      nome: gruppo.nome,
      colore: gruppo.colore ?? "",
      attivo: gruppo.attivo,
      membri: new Map(gruppo.membri.map((membro) => [membro.prodottoId, membro.ordinamento])),
    });
  }, []);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<RigaProdotto>>) => {
    gridApiRef.current = event.api;
  }, []);

  /**
   * La spunta aggiunge o toglie il prodotto dal gruppo in lavorazione.
   *
   * ⚠️ L'ordine di default è **in coda**, non 0: un prodotto appena spuntato non deve
   * scavalcare quelli che qualcuno ha già disposto.
   */
  const commutaMembro = useCallback((prodottoId: number) => {
    setBozza((precedente) => {
      const membri = new Map(precedente.membri);
      if (membri.has(prodottoId)) {
        membri.delete(prodottoId);
      } else {
        membri.set(prodottoId, membri.size + 1);
      }
      return { ...precedente, membri };
    });
  }, []);

  const columnDefs = useMemo<DatagridColDef<RigaProdotto>[]>(
    () => [
      {
        headerName: "Nel gruppo",
        field: "prodottoId",
        width: 120,
        cellRenderer: (params: { data?: DatagridData<RigaProdotto> }) => {
          const id = params.data?.prodottoId;
          if (id == null) {
            return null;
          }
          const dentro = bozza.membri.has(id);
          return (
            <Chip
              size="small"
              label={dentro ? "Sì" : "No"}
              color={dentro ? "primary" : "default"}
              variant={dentro ? "filled" : "outlined"}
              onClick={() => commutaMembro(id)}
            />
          );
        },
      },
      {
        headerName: "Ordine",
        field: "ordine",
        width: 100,
        editable: true,
        cellDataType: "number",
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
        // ⚠️ Scrive sull'APPARTENENZA, non sul prodotto: lo stesso spritz può essere il primo
        //    qui e il terzo in un altro gruppo.
        valueFormatter: (params) => (params.value ? String(params.value) : ""),
        headerTooltip: "L'ordine della variante dentro QUESTO gruppo. È per gruppo, non per prodotto.",
      },
      { headerName: "Codice", field: "codice", width: 150, filter: "agTextColumnFilter" },
      { headerName: "Nome", field: "nome", flex: 2, minWidth: 180, filter: "agTextColumnFilter" },
      { headerName: "Categoria", field: "categoria", width: 150, filter: "agTextColumnFilter" },
      { headerName: "Prezzo", field: "prezzo", width: 110, cellClass: "ag-right-aligned-cell" },
      {
        headerName: "Altri gruppi",
        field: "prodottoId",
        colId: "altriGruppi",
        width: 130,
        // ⚠️ Un prodotto in più gruppi è voluto, non un errore: comparirà sotto entrambi i
        //    tastoni. La colonna lo dice invece di impedirlo.
        cellRenderer: (params: { data?: DatagridData<RigaProdotto> }) => {
          const quanti = appartenenze.get(params.data?.prodottoId ?? -1) ?? 0;
          return quanti > 1 ? (
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={`in ${quanti} gruppi`}
            />
          ) : null;
        },
      },
    ],
    [appartenenze, bozza.membri, commutaMembro]
  );

  const handleCellValueChanged = useCallback((evento: { data?: DatagridData<RigaProdotto> }) => {
    const riga = evento.data;
    if (!riga) {
      return;
    }
    setBozza((precedente) => {
      // Un ordine scritto su una riga fuori dal gruppo non la fa entrare: sarebbe un ingresso
      // silenzioso, e la spunta esiste apposta per dichiararlo.
      if (!precedente.membri.has(riga.prodottoId)) {
        return precedente;
      }
      const membri = new Map(precedente.membri);
      membri.set(riga.prodottoId, Number(riga.ordine) || 0);
      return { ...precedente, membri };
    });
  }, []);

  const handleSalva = useCallback(async () => {
    try {
      await salvaGruppo({
        variables: {
          gruppo: {
            gruppoProdottiId: bozza.gruppoProdottiId,
            codice: bozza.codice.trim(),
            nome: bozza.nome.trim(),
            colore: bozza.colore.trim() || null,
            attivo: bozza.attivo,
            membri: [...bozza.membri].map(([prodottoId, ordinamento]) => ({ prodottoId, ordinamento })),
          },
        },
      });
      await ricaricaGruppi();
      showToast({ type: "success", position: "bottom-right", message: "Gruppo salvato", autoClose: 2500 });
      setBozza(BOZZA_VUOTA);
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
    if (!bozza.gruppoProdottiId) {
      return;
    }
    try {
      await eliminaGruppo({ variables: { gruppoProdottiId: bozza.gruppoProdottiId } });
      await ricaricaGruppi();
      showToast({ type: "success", position: "bottom-right", message: "Gruppo sciolto: i prodotti restano nel listino", autoClose: 3500 });
      setBozza(BOZZA_VUOTA);
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Scioglimento non riuscito",
        autoClose: 8000,
      });
    }
  }, [bozza.gruppoProdottiId, eliminaGruppo, ricaricaGruppi]);

  const inCorso = salvataggioInCorso || eliminazioneInCorso;
  const salvabile = Boolean(bozza.codice.trim() && bozza.nome.trim()) && !inCorso;

  return (
    <Box sx={{ display: "flex", gap: 2, height: "calc(100dvh - 120px)", p: 1.5 }}>
      {/* ── I gruppi esistenti ────────────────────────────────────────────────────────────── */}
      <Paper sx={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ p: 1.5, pb: 1 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setBozza(BOZZA_VUOTA)}
          >
            Nuovo gruppo
          </Button>
        </Box>
        <Divider />
        <List
          dense
          sx={{ overflow: "auto", flex: 1 }}
        >
          {gruppi.map((gruppo) => (
            <ListItemButton
              key={gruppo.gruppoProdottiId}
              selected={bozza.gruppoProdottiId === gruppo.gruppoProdottiId}
              onClick={() => apriGruppo(gruppo)}
            >
              <ListItemText
                primary={gruppo.nome}
                secondary={`${gruppo.membri.length} ${gruppo.membri.length === 1 ? "variante" : "varianti"}${gruppo.attivo ? "" : " · spento"}`}
              />
            </ListItemButton>
          ))}
          {gruppi.length === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Nessun gruppo. Il primo si crea qui accanto.
              </Typography>
            </Box>
          )}
        </List>
      </Paper>

      {/* ── Il gruppo in lavorazione ──────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <Paper sx={{ p: 1.5, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Codice"
            value={bozza.codice}
            onChange={(evento) => setBozza((precedente) => ({ ...precedente, codice: evento.target.value }))}
            sx={{ width: 160 }}
            helperText="Chiave stabile, univoca"
          />
          <TextField
            size="small"
            label="Nome sul tastone"
            value={bozza.nome}
            onChange={(evento) => setBozza((precedente) => ({ ...precedente, nome: evento.target.value }))}
            sx={{ width: 220 }}
          />
          <TextField
            size="small"
            label="Colore"
            placeholder="#F4801A"
            value={bozza.colore}
            onChange={(evento) => setBozza((precedente) => ({ ...precedente, colore: evento.target.value }))}
            sx={{ width: 150 }}
            helperText="Vuoto = colore automatico"
          />
          <FormControlLabel
            control={<Switch
              checked={bozza.attivo}
              onChange={(evento) => setBozza((precedente) => ({ ...precedente, attivo: evento.target.checked }))}
            />}
            label="Attivo"
          />

          <Box sx={{ flex: 1 }} />

          {bozza.gruppoProdottiId && (
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
        </Paper>

        <Alert
          severity="info"
          sx={{ py: 0.25 }}
        >
          Un prodotto può stare in <strong>più gruppi</strong>: comparirà sotto entrambi i tastoni, ed è voluto. Sciogliere un gruppo non elimina i prodotti.
        </Alert>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Datagrid<RigaProdotto>
            gridId="gruppi-prodotti"
            height="100%"
            items={righe}
            columnDefs={columnDefs}
            readOnly={false}
            hideToolbar
            getRowId={({ data }) => data.prodottoId.toString()}
            onGridReady={handleGridReady}
            onCellValueChanged={handleCellValueChanged}
          />
        </Box>
      </Box>
    </Box>
  );
}

export default GruppiProdotti;
