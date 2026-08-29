import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { GridReadyEvent, ICellRendererParams } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import useGetAll from "../../../graphql/common/useGetAll";
import useSubmitProdotto from "../../../graphql/prodotti/useSubmitProdotto";
import { prodottoCassaFragment } from "../../../graphql/prodotti/fragments";

/** Le sole aliquote che il server accetta (`IvaCalculator.AliquoteAmmessePercentuali`). */
const ALIQUOTE_AMMESSE = [0, 4, 5, 10, 22];

/** Unità di misura viste nel listino. Il campo resta libero: l'elenco è un suggerimento, non un vincolo. */
const UNITA_DI_MISURA = ["pz", "kg", "l", "gr", "cl"];

/**
 * Una riga non ancora salvata vive con un identificativo **negativo**, così `getRowId` resta
 * unico e stabile senza inventare un secondo criterio. Il server non vede mai questi numeri:
 * al salvataggio l'input parte con `prodottoId: null`, che per l'upsert significa creazione.
 */
function nuovaBozza(idProvvisorio: number): ProdottoCassa {
  return {
    prodottoId: idProvvisorio,
    codice: "",
    nome: "",
    descrizione: null,
    prezzo: 0,
    categoria: null,
    unitaDiMisura: "pz",
    attivo: true,
    // 10% e non il 22 del server: è l'aliquota di tutto il listino del locale, e far ripartire
    // ogni riga dal valore sbagliato è un errore che si nota solo mesi dopo, in liquidazione.
    aliquotaIva: 10,
    // 0 vuol dire «mai ordinato», non «primo»: una riga nuova non deve scavalcare al bancone
    // le tessere che qualcuno ha disposto a mano.
    ordinamento: 0,
    createdAt: "",
    updatedAt: "",
  };
}

function ProdottiList() {
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<ProdottoCassa>> | null>(null);
  // Vero mentre si rimette a posto una cella rifiutata dal server: senza, `setDataValue`
  // rientrerebbe in `onCellValueChanged` e la riga verrebbe risalvata in cerchio.
  const ripristinoRef = useRef(false);
  const contatoreBozzeRef = useRef(0);

  const [bozze, setBozze] = useState<ProdottoCassa[]>([]);
  const [mostraNonAttivi, setMostraNonAttivi] = useState(true);

  const { submitProdotto } = useSubmitProdotto();

  // ⚠️ La connection `prodotti` restituisce **anche i non attivi**, al contrario della query
  // `vendite { prodotti }` che filtra su `attivo`. Qui serve proprio l'anagrafica completa:
  // un prodotto disattivato che sparisse dalla lista non sarebbe più riattivabile da nessuna
  // parte dell'applicazione.
  const { data: prodotti, refetch } = useGetAll<ProdottoCassa>({
    fragment: prodottoCassaFragment,
    queryName: "prodotti",
    fragmentBody: "...ProdottoCassaFragment",
    orderBy: "codice ASC",
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    setTitle("Prodotti");
  }, [setTitle]);

  const righe = useMemo(() => [...bozze, ...prodotti], [bozze, prodotti]);

  const categorie = useMemo(
    () => Array.from(new Set(prodotti.map((prodotto) => prodotto.categoria).filter((categoria): categoria is string => Boolean(categoria)))).sort(),
    [prodotti]
  );

  const handleNuovo = useCallback(() => {
    contatoreBozzeRef.current -= 1;
    const bozza = nuovaBozza(contatoreBozzeRef.current);
    setBozze((precedenti) => [bozza, ...precedenti]);
    // Il fuoco va sul codice: è l'unico campo che non si può cambiare idea di scrivere dopo,
    // perché senza di esso la riga non viene mai salvata.
    setTimeout(() => {
      gridRef.current?.api.startEditingCell({ rowIndex: 0, colKey: "codice" });
    }, 0);
  }, []);

  /**
   * Persistenza per riga, come nella griglia di vetrina: si invia **l'intera riga**, perché
   * l'upsert del server fa un'assegnazione totale di tutti i campi di cassa. Inviarne uno solo
   * azzererebbe gli altri.
   *
   * Una riga senza codice o senza nome **non si salva**: sono i due campi che il server rifiuta
   * comunque, e provarci a ogni tasto riempirebbe la pagina di errori mentre si sta ancora
   * scrivendo.
   */
  const salvaRiga = useCallback(
    async (event: DatagridCellValueChangedEvent<ProdottoCassa>) => {
      const riga = event.data;
      if (!riga) {
        return;
      }
      const codice = (riga.codice ?? "").trim();
      const nome = (riga.nome ?? "").trim();
      if (!codice || !nome) {
        return;
      }

      const eraBozza = riga.prodottoId <= 0;
      try {
        const salvato = await submitProdotto({
          prodottoId: eraBozza ? null : riga.prodottoId,
          codice,
          nome,
          descrizione: riga.descrizione || null,
          prezzo: Number(riga.prezzo) || 0,
          categoria: riga.categoria || null,
          unitaDiMisura: riga.unitaDiMisura || "pz",
          attivo: Boolean(riga.attivo),
          aliquotaIva: Number(riga.aliquotaIva),
          ordinamento: Number(riga.ordinamento) || 0,
        });
        if (!salvato) {
          return;
        }

        if (eraBozza) {
          // La bozza ha finito il suo compito: sparisce, e la riga vera arriva dalla rilettura
          // con l'identificativo assegnato dal server.
          setBozze((precedenti) => precedenti.filter((bozza) => bozza.prodottoId !== riga.prodottoId));
          refetch();
          return;
        }

        ripristinoRef.current = true;
        event.node.setData({ ...riga, ...salvato });
        ripristinoRef.current = false;
        event.api.refreshCells({ rowNodes: [event.node], force: true });
      } catch (errore) {
        // La cella non resta a mostrare un valore che il server ha rifiutato: si rimette il
        // precedente e si dice perché. I messaggi (codice duplicato, aliquota non ammessa,
        // prezzo negativo) sono già scritti per essere letti da chi sta compilando.
        ripristinoRef.current = true;
        const campo = event.colDef.field;
        if (campo) {
          event.node.setDataValue(campo, event.oldValue);
        }
        ripristinoRef.current = false;
        showToast({
          type: "error",
          position: "bottom-right",
          message: errore instanceof Error ? errore.message : "Salvataggio non riuscito",
          autoClose: 6000,
          toastId: "prodotto-salvataggio-errore",
        });
      }
    },
    [refetch, submitProdotto]
  );

  const handleCellValueChanged = useCallback(
    (event: DatagridCellValueChangedEvent<ProdottoCassa>) => {
      if (ripristinoRef.current) {
        return;
      }
      void salvaRiga(event);
    },
    [salvaRiga]
  );

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<ProdottoCassa>>) => {
    gridRef.current = event;
  }, []);

  // Filtro client-side: `useGetAll` ha già esaurito le pagine, quindi nascondere i non attivi
  // non costa nemmeno una richiesta.
  const handleToggleNonAttivi = useCallback((mostra: boolean) => {
    setMostraNonAttivi(mostra);
    gridRef.current?.api.setFilterModel(mostra ? null : { attivo: { filterType: "text", type: "equals", filter: "attivo" } });
  }, []);

  const columnDefs = useMemo<DatagridColDef<ProdottoCassa>[]>(
    () => [
      {
        headerName: "Codice",
        field: "codice",
        width: 130,
        editable: true,
        filter: "agTextColumnFilter",
        headerTooltip: "Chiave univoca del listino. Non esiste modo di eliminare un prodotto: un codice sbagliato si corregge, non si ricrea.",
      },
      {
        headerName: "Nome",
        field: "nome",
        flex: 2,
        minWidth: 200,
        editable: true,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Prezzo",
        field: "prezzo",
        width: 120,
        editable: true,
        cellDataType: "number",
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 2 },
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "IVA",
        field: "aliquotaIva",
        width: 100,
        editable: true,
        cellDataType: "number",
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: { values: ALIQUOTE_AMMESSE },
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        // Percentuale, non frazione: 10 vuol dire 10%. La conversione per i calcoli è del server.
        valueFormatter: (params) => (params.value === null || params.value === undefined ? "" : `${params.value}%`),
        headerTooltip: "Aliquota in percentuale. Ammesse solo 0, 4, 5, 10 e 22.",
      },
      {
        headerName: "Categoria",
        field: "categoria",
        width: 170,
        editable: true,
        filter: "agTextColumnFilter",
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: {
          values: categorie,
          allowTyping: true,
          filterList: true,
          searchType: "match",
        },
        headerTooltip: "Categoria contabile, per i raggruppamenti di cassa. Non è la categoria con cui il prodotto compare sul sito: quella si imposta in Sito › Prodotti vetrina.",
      },
      {
        headerName: "Ordine",
        field: "ordinamento",
        width: 110,
        editable: true,
        cellDataType: "number",
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        sortable: true,
        // 0 non si scrive: è l'assenza di una scelta, e un listino pieno di zeri nasconderebbe
        // le poche righe davvero disposte a mano.
        valueFormatter: (params) => (params.value ? String(params.value) : ""),
        headerTooltip: "Ordine con cui la tessera compare al punto vendita, dentro la sua categoria. Vuoto significa «mai ordinato»: quelle righe restano in coda, in ordine di codice. Non è l'ordine del sito, che si imposta in Sito › Prodotti vetrina.",
      },
      {
        headerName: "U.M.",
        field: "unitaDiMisura",
        width: 90,
        editable: true,
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: { values: UNITA_DI_MISURA, allowTyping: true },
      },
      {
        headerName: "Attivo",
        field: "attivo",
        width: 110,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: (params: ICellRendererParams<DatagridData<ProdottoCassa>>) => (
          <Chip
            label={params.value ? "Attivo" : "Disattivo"}
            color={params.value ? "success" : "default"}
            size="small"
          />
        ),
        cellEditor: "agCheckboxCellEditor",
        // Il filtro legge una stringa e non il booleano: rende deterministico il modello di
        // filtro applicato dall'interruttore in toolbar.
        filter: "agTextColumnFilter",
        filterValueGetter: (params) => (params.data?.attivo ? "attivo" : "disattivo"),
        headerTooltip: "Disattivare toglie il prodotto dalla vendita E dal menu pubblico del sito.",
      },
      {
        headerName: "Descrizione",
        field: "descrizione",
        flex: 3,
        minWidth: 220,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 2000, rows: 6, cols: 60 },
        headerTooltip: "Nota interna di cassa. Il sito NON la usa: la descrizione pubblica è un campo a parte, e senza di quella il prodotto esce online senza descrizione.",
      },
    ],
    [categorie]
  );

  return (
    <>
      {/* 🔴 Niente "Elimina": non esiste una mutation che cancelli un prodotto, perché le
          vendite lo referenziano con vincolo restrittivo. Un pulsante che fallisce sempre
          sarebbe peggio della sua assenza — si disattiva, e il prodotto esce dal listino
          operativo restando nella storia contabile. */}
      <ListToolbar
        hideDeleteButton
        onNew={handleNuovo}
      />
      <Box
        className="scrollable-box"
        sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100dvh - 64px - 48px)" }}
      >
        <Typography
          id="view-title"
          variant="h5"
          gutterBottom
        >
          Prodotti
        </Typography>
        {bozze.length > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 1 }}
          >
            Una riga nuova viene salvata appena hanno un valore <strong>codice</strong> e <strong>nome</strong>. Il codice è definitivo: i prodotti non si eliminano.
          </Alert>
        )}
        <Datagrid<ProdottoCassa>
          gridId="prodotti-cassa"
          height="calc(100% - 50px)"
          items={righe}
          columnDefs={columnDefs}
          readOnly={false}
          hideToolbar
          getRowId={({ data }) => data.prodottoId.toString()}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          onGridReady={handleGridReady}
          onCellValueChanged={handleCellValueChanged}
          additionalToolbarButtons={
            <FormControlLabel
              control={<Switch
                size="small"
                checked={mostraNonAttivi}
                onChange={(event) => handleToggleNonAttivi(event.target.checked)}
              />}
              label="Mostra non attivi"
              slotProps={{ typography: { variant: "body2" } }}
            />
          }
        />
      </Box>
    </>
  );
}

export default ProdottiList;
