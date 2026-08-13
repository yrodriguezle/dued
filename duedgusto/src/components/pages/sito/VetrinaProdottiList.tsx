import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { GridReadyEvent, ICellRendererParams } from "ag-grid-community";

import MediaPickerDialog from "./MediaPickerDialog";
import SitoGuard from "./SitoGuard";
import { larghezzaAnteprima, mediaUrl } from "./mediaUrl";
import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import formatCurrency from "../../../common/bones/formatCurrency";
import showToast from "../../../common/toast/showToast";
import useGetAll from "../../../graphql/common/useGetAll";
import { prodottoVetrinaFragment } from "../../../graphql/vetrina/fragments";
import { mutationMutateProdottoVetrina } from "../../../graphql/vetrina/mutations";

const AVVISO_DIVERGENZA = "Visibile sul sito ma non attivo in cassa: non verrà pubblicato";

/** I dieci campi vetrina, e nient'altro: è la stessa forma che il server accetta. */
function inputDaRiga(riga: ProdottoVetrina): ProdottoVetrinaInput {
  return {
    visibileSulSito: Boolean(riga.visibileSulSito),
    nomeVetrina: riga.nomeVetrina || null,
    descrizioneVetrina: riga.descrizioneVetrina || null,
    categoriaVetrina: riga.categoriaVetrina || null,
    // 0 è un prezzo valido (omaggio): solo l'assenza vera diventa null, e il sito ricade
    // sul listino di cassa.
    prezzoVetrina: riga.prezzoVetrina === null || riga.prezzoVetrina === undefined ? null : Number(riga.prezzoVetrina),
    immagineId: riga.immagineId ?? null,
    ordinamentoVetrina: Number(riga.ordinamentoVetrina) || 0,
    allergeni: riga.allergeni || null,
    novita: Boolean(riga.novita),
    consigliato: Boolean(riga.consigliato),
    // ⚠️ Svuotare la cella deve poter TOGLIERE il piatto dalla lavagna, quindi la stringa
    //    vuota diventa `null` e non `""`: l'assegnazione del server è totale, e un `""`
    //    arriverebbe come data non valida invece che come assenza.
    inLavagnaDal: riga.inLavagnaDal || null,
  };
}

function VetrinaProdottiList() {
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<ProdottoVetrina>> | null>(null);
  // Vero mentre si rimette a posto una cella rifiutata: senza, setDataValue rientrerebbe
  // in onCellValueChanged e la riga verrebbe risalvata in cerchio.
  const ripristinoRef = useRef(false);
  const [mostraNonAttivi, setMostraNonAttivi] = useState(true);
  const [prodottoInScelta, setProdottoInScelta] = useState<ProdottoVetrina | null>(null);

  const [mutateProdottoVetrina] = useMutation(mutationMutateProdottoVetrina);

  const { data: prodotti } = useGetAll<ProdottoVetrina>({
    fragment: prodottoVetrinaFragment,
    queryName: "prodotti",
    fragmentBody: "...ProdottoVetrinaFragment",
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    setTitle("Prodotti vetrina");
  }, [setTitle]);

  const categorieVetrina = useMemo(
    () => Array.from(new Set(prodotti.map((prodotto) => prodotto.categoriaVetrina).filter((categoria): categoria is string => Boolean(categoria)))).sort(),
    [prodotti]
  );

  /**
   * Persistenza per riga: si invia **l'intera riga vetrina**, non il solo campo toccato,
   * perché la mutation fa un'assegnazione totale dei dieci campi. Inviarne uno solo
   * azzererebbe gli altri nove.
   */
  const salvaRiga = useCallback(
    async (event: DatagridCellValueChangedEvent<ProdottoVetrina>) => {
      const riga = event.data;
      if (!riga) {
        return;
      }
      try {
        const risultato = await mutateProdottoVetrina({
          variables: { prodottoId: riga.prodottoId, input: inputDaRiga(riga) },
        });
        const aggiornato = risultato.data?.vetrina?.mutateProdottoVetrina;
        if (aggiornato) {
          // I due derivati (pubblicatoSulSito, prezzoEffettivoVetrina) li calcola il server:
          // si rileggono da lì invece di rifarne la regola qui.
          ripristinoRef.current = true;
          event.node.setData({ ...riga, ...aggiornato });
          ripristinoRef.current = false;
          event.api.refreshCells({ rowNodes: [event.node], force: true });
        }
      } catch (errore) {
        // La cella non resta a mostrare un valore che il server ha rifiutato: si rimette il
        // precedente e si dice perché.
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
          toastId: "vetrina-salvataggio-errore",
        });
      }
    },
    [mutateProdottoVetrina]
  );

  const handleCellValueChanged = useCallback(
    (event: DatagridCellValueChangedEvent<ProdottoVetrina>) => {
      if (ripristinoRef.current) {
        return;
      }
      void salvaRiga(event);
    },
    [salvaRiga]
  );

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<ProdottoVetrina>>) => {
    gridRef.current = event;
  }, []);

  // Filtro client-side: `useGetAll` ha già esaurito le pagine, quindi nascondere i non attivi
  // non costa nemmeno una richiesta.
  const handleToggleNonAttivi = useCallback((mostra: boolean) => {
    setMostraNonAttivi(mostra);
    gridRef.current?.api.setFilterModel(mostra ? null : { attivo: { filterType: "text", type: "equals", filter: "attivo" } });
  }, []);

  const handleScegliImmagine = useCallback(
    (mediaAssetId: number | null) => {
      const prodotto = prodottoInScelta;
      setProdottoInScelta(null);
      if (!prodotto || !gridRef.current) {
        return;
      }
      const node = gridRef.current.api.getRowNode(String(prodotto.prodottoId));
      if (node) {
        // setDataValue fa scattare la stessa persistenza per riga della modifica inline.
        node.setDataValue("immagineId", mediaAssetId);
      }
    },
    [prodottoInScelta]
  );

  const columnDefs = useMemo<DatagridColDef<ProdottoVetrina>[]>(
    () => [
      // ── Cassa: sola lettura. Non è una scelta di comodo — la griglia della vetrina non
      // possiede questi campi, e l'input della mutation nemmeno.
      {
        headerName: "Codice",
        field: "codice",
        width: 110,
        editable: false,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Nome (cassa)",
        field: "nome",
        flex: 2,
        minWidth: 180,
        editable: false,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Prezzo",
        field: "prezzo",
        width: 110,
        editable: false,
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Attivo",
        field: "attivo",
        width: 110,
        editable: false,
        filter: "agTextColumnFilter",
        // Il filtro legge una stringa e non il booleano: rende deterministico il modello di
        // filtro applicato dal toggle in toolbar.
        filterValueGetter: (params) => (params.data?.attivo ? "attivo" : "disattivo"),
        cellRenderer: (params: ICellRendererParams<DatagridData<ProdottoVetrina>>) => (
          <Chip
            label={params.value ? "Attivo" : "Disattivo"}
            color={params.value ? "success" : "default"}
            size="small"
          />
        ),
      },
      {
        headerName: "Sul sito",
        field: "pubblicatoSulSito",
        width: 130,
        editable: false,
        tooltipValueGetter: (params) => (params.data?.visibileSulSito && !params.data?.attivo ? AVVISO_DIVERGENZA : ""),
        cellRenderer: (params: ICellRendererParams<DatagridData<ProdottoVetrina>>) => (
          <Chip
            label={params.value ? "Pubblicato" : "Non pubblicato"}
            color={params.value ? "success" : "default"}
            variant={params.value ? "filled" : "outlined"}
            size="small"
          />
        ),
      },

      // ── Vetrina: gli unici campi scrivibili da questa pagina.
      {
        headerName: "Visibile",
        field: "visibileSulSito",
        width: 110,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
      },
      {
        headerName: "Nome vetrina",
        field: "nomeVetrina",
        flex: 2,
        minWidth: 180,
        editable: true,
        // Vuoto non è un buco: il sito mostra il nome di cassa.
        cellRenderer: (params: ICellRendererParams<DatagridData<ProdottoVetrina>>) =>
          params.value || (
            <Typography
              variant="body2"
              color="text.disabled"
              component="span"
            >
              {params.data?.nome}
            </Typography>
          ),
      },
      {
        headerName: "Categoria vetrina",
        field: "categoriaVetrina",
        width: 170,
        editable: true,
        cellEditor: "agRichSelectCellEditor",
        cellEditorParams: {
          values: categorieVetrina,
          allowTyping: true,
          filterList: true,
          searchType: "match",
        },
      },
      {
        headerName: "Prezzo vetrina",
        field: "prezzoVetrina",
        width: 140,
        editable: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 2 },
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        // null = "come cassa"; 0 invece è un prezzo, e va mostrato come tale.
        valueFormatter: (params) => (params.value === null || params.value === undefined ? "come cassa" : formatCurrency(params.value)),
      },
      {
        headerName: "Immagine",
        field: "immagineId",
        width: 130,
        editable: false,
        sortable: false,
        onCellClicked: (params) => {
          if (params.data) {
            setProdottoInScelta(params.data);
          }
        },
        cellRenderer: (params: ICellRendererParams<DatagridData<ProdottoVetrina>>) => {
          const immagine = params.data?.immagine;
          if (immagine) {
            const larghezza = larghezzaAnteprima(immagine.larghezzeDisponibili);
            return (
              <Box
                component="img"
                src={larghezza ? mediaUrl(immagine.chiave, larghezza) : undefined}
                alt={immagine.testoAlternativo || immagine.nomeOriginale}
                sx={{ height: 28, width: 44, objectFit: "cover", cursor: "pointer", verticalAlign: "middle" }}
              />
            );
          }
          // Un prodotto destinato al sito ma senza foto è un buco visibile in vetrina: qui è
          // l'unico posto in cui si può notare prima che lo noti un cliente.
          if (params.data?.visibileSulSito) {
            return (
              <Chip
                label="Senza immagine"
                color="warning"
                size="small"
              />
            );
          }
          return (
            <Typography
              variant="body2"
              color="text.disabled"
              component="span"
            >
              scegli…
            </Typography>
          );
        },
      },
      {
        headerName: "Ordine",
        field: "ordinamentoVetrina",
        width: 100,
        editable: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
      },
      {
        headerName: "Novità",
        field: "novita",
        width: 100,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
      },
      {
        headerName: "Consigliato",
        field: "consigliato",
        width: 120,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
      },
      {
        headerName: "In lavagna il",
        field: "inLavagnaDal",
        width: 150,
        editable: true,
        cellDataType: "dateString",
        cellEditor: "agDateStringCellEditor",
        // ⚠️ La colonna mostra una DATA e non una spunta, ed è la sola cosa che conta qui: il
        //    sito rende la lavagna solo per i prodotti il cui valore è OGGI. Un interruttore
        //    resterebbe acceso finché qualcuno se ne ricorda, e il primo lunedì di fretta la
        //    home mostrerebbe il piatto di venerdì scorso come «lavagna di oggi». Una data
        //    scade da sola: dimenticarsene fa sparire la sezione, che è il modo giusto di
        //    sbagliare.
        headerTooltip: "Il giorno in cui il piatto sta sulla lavagna all'ingresso. Il sito lo mostra solo se è oggi: una data passata non compare più. Svuota per toglierlo.",
        cellClassRules: {
          // Oggi si evidenzia: è l'unica riga che sta davvero producendo qualcosa sul sito, e
          // in una griglia di quaranta prodotti non si trova a occhio.
          "font-semibold": (parametri) => parametri.value === new Date().toLocaleDateString("sv-SE"),
        },
      },
      {
        headerName: "Allergeni",
        field: "allergeni",
        width: 200,
        editable: true,
      },
      {
        headerName: "Descrizione vetrina",
        field: "descrizioneVetrina",
        flex: 3,
        minWidth: 220,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 2000, rows: 8, cols: 60 },
      },
    ],
    [categorieVetrina]
  );

  return (
    <SitoGuard>
      {/* 🔴 Niente "Nuovo" e niente "Elimina": i prodotti nascono e muoiono in cassa. Il
          confine non è un promemoria, è la forma del componente. */}
      <ListToolbar
        hideNewButton
        hideDeleteButton
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
          Prodotti vetrina
        </Typography>
        <Datagrid<ProdottoVetrina>
          gridId="vetrina-prodotti"
          height="calc(100% - 50px)"
          items={prodotti}
          columnDefs={columnDefs}
          readOnly={false}
          hideToolbar
          getRowId={({ data }) => data.prodottoId.toString()}
          // Selezione senza casella: una casella suggerisce un'azione di gruppo che qui non
          // esiste — non c'è nulla da eliminare da questa pagina.
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

      <MediaPickerDialog
        open={Boolean(prodottoInScelta)}
        selezionatoId={prodottoInScelta?.immagineId ?? null}
        onClose={() => setProdottoInScelta(null)}
        onSelect={handleScegliImmagine}
      />
    </SitoGuard>
  );
}

export default VetrinaProdottiList;
