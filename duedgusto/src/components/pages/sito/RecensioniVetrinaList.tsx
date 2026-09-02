import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { GridReadyEvent } from "ag-grid-community";

import SitoGuard from "./SitoGuard";
import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import showToast from "../../../common/toast/showToast";
import { getRecensioniVetrina } from "../../../graphql/vetrina/queries";
import { mutationEliminaRecensioneVetrina, mutationMutateRecensioneVetrina } from "../../../graphql/vetrina/mutations";

/**
 * Le recensioni **riportate** sul sito.
 *
 * 🔴 **Il sito non raccoglie giudizi.** Non c'è alcun form pubblico e nessuna rotta anonima
 * scrive su questa tabella: sono citazioni che l'amministratore sceglie da ciò che i clienti
 * hanno già scritto altrove. È la stessa cosa che fa il mockup, con la firma «Recensione
 * Google».
 *
 * ⚠️ **Riportare una recensione altrui è una citazione**, e va riportata fedelmente e
 * attribuita. Riscriverne il testo «perché suoni meglio» e lasciarci la firma di un cliente non
 * è marketing: è un'affermazione falsa attribuita a una persona reale. L'avviso in cima alla
 * pagina lo dice a chi la compila, che è l'unico momento in cui serve saperlo.
 *
 * ⚠️ Nessuna paginazione: sono tre o quattro citazioni per una home, non un archivio. Una
 * connection porterebbe cursori e pagine per una lista che sta in una schermata, e nasconderebbe
 * il fatto che l'ordine è **manuale**.
 */
function RecensioniVetrinaList() {
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();
  const gridRef = useRef<GridReadyEvent<DatagridData<RecensioneVetrina>> | null>(null);
  // Vero mentre si rimette a posto una cella rifiutata: senza, setDataValue rientrerebbe in
  // onCellValueChanged e la riga verrebbe risalvata in cerchio.
  const ripristinoRef = useRef(false);
  const [selezionata, setSelezionata] = useState<RecensioneVetrina | null>(null);

  const { data, loading, error } = useQuery(getRecensioniVetrina, { fetchPolicy: "cache-and-network" });

  const opzioniRefetch = { refetchQueries: [{ query: getRecensioniVetrina }], awaitRefetchQueries: true };
  const [mutateRecensione] = useMutation(mutationMutateRecensioneVetrina, opzioniRefetch);
  const [eliminaRecensione] = useMutation(mutationEliminaRecensioneVetrina, opzioniRefetch);

  useEffect(() => {
    setTitle("Recensioni sito");
  }, [setTitle]);

  const recensioni = useMemo(() => data?.vetrina?.recensioni ?? [], [data]);

  const salvaRiga = useCallback(
    async (event: DatagridCellValueChangedEvent<RecensioneVetrina>) => {
      const riga = event.data;
      if (!riga) {
        return;
      }
      try {
        await mutateRecensione({
          variables: {
            recensioneVetrinaId: riga.recensioneVetrinaId,
            input: {
              autore: riga.autore ?? "",
              testo: riga.testo ?? "",
              fonte: riga.fonte || null,
              punteggio: Number(riga.punteggio) || 5,
              ordinamento: Number(riga.ordinamento) || 0,
              pubblicata: Boolean(riga.pubblicata),
            },
          },
        });
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
          toastId: "recensione-salvataggio-errore",
        });
      }
    },
    [mutateRecensione]
  );

  const handleCellValueChanged = useCallback(
    (event: DatagridCellValueChangedEvent<RecensioneVetrina>) => {
      if (ripristinoRef.current) {
        return;
      }
      void salvaRiga(event);
    },
    [salvaRiga]
  );

  /**
   * La nuova riga nasce **non pubblicata**, con un testo segnaposto che si vede subito.
   *
   * 🔴 Non si crea una riga vuota nella griglia in attesa del salvataggio: il server rifiuta
   * autore e testo vuoti, quindi una riga «da compilare» resterebbe lì a fallire a ogni
   * modifica di cella, e l'errore direbbe una cosa vera in un momento in cui non serve.
   */
  const handleNew = useCallback(async () => {
    try {
      await mutateRecensione({
        variables: {
          recensioneVetrinaId: null,
          input: {
            autore: "Recensione Google",
            testo: "Incolla qui il testo della recensione, così com'è.",
            fonte: "Google",
            punteggio: 5,
            // ⚠️ Non `recensioni.at(-1)`: il `lib` di questo progetto è precedente a es2022 e
            //    `Array.prototype.at` non è nei tipi. In coda va il massimo + 1, che è anche
            //    più onesto di «l'ultima della lista»: l'ordine potrebbe avere buchi.
            ordinamento: recensioni.reduce((massimo, r) => Math.max(massimo, r.ordinamento), 0) + 1,
            pubblicata: false,
          },
        },
      });
      showToast({ type: "success", position: "bottom-right", message: "Recensione creata: non è ancora pubblicata", toastId: "recensione-creata" });
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Creazione non riuscita",
        toastId: "recensione-creazione-errore",
      });
    }
  }, [mutateRecensione, recensioni]);

  const handleDelete = useCallback(async () => {
    if (!selezionata) {
      return;
    }
    const confermato = await onConfirm({
      title: "Elimina recensione",
      content: `Eliminare definitivamente la citazione di «${selezionata.autore}»?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });
    if (!confermato) {
      return;
    }
    try {
      await eliminaRecensione({ variables: { recensioneVetrinaId: selezionata.recensioneVetrinaId } });
      setSelezionata(null);
    } catch (errore) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Eliminazione non riuscita",
        toastId: "recensione-eliminazione-errore",
      });
    }
  }, [eliminaRecensione, onConfirm, selezionata]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<RecensioneVetrina>>) => {
    gridRef.current = event;
  }, []);

  const columnDefs = useMemo<DatagridColDef<RecensioneVetrina>[]>(
    () => [
      {
        headerName: "Ordine",
        field: "ordinamento",
        width: 100,
        editable: true,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 0 },
        headerTooltip: "L'ordine in cui compaiono in home. A parità vince la più recente.",
      },
      {
        headerName: "Pubblicata",
        field: "pubblicata",
        width: 130,
        editable: true,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
        headerTooltip: "Solo le pubblicate escono dall'API del sito. Una recensione appena inserita non è pubblicata.",
      },
      {
        headerName: "Stelle",
        field: "punteggio",
        width: 100,
        editable: true,
        cellEditor: "agNumberCellEditor",
        // Il vincolo è anche a database (CHECK 1..5): qui si evita solo di far viaggiare un
        // valore che verrebbe rifiutato.
        cellEditorParams: { min: 1, max: 5, precision: 0 },
      },
      {
        headerName: "Firma",
        field: "autore",
        width: 200,
        editable: true,
        headerTooltip: "Come va firmata in pagina. È una firma, non un identificativo: non deve dire di una persona più di quanto quella persona abbia già reso pubblico.",
      },
      {
        headerName: "Fonte",
        field: "fonte",
        width: 130,
        editable: true,
        headerTooltip: 'Da dove viene la citazione, es. "Google". Compare sotto il testo.',
      },
      {
        headerName: "Testo",
        field: "testo",
        flex: 1,
        minWidth: 320,
        editable: true,
        cellEditor: "agLargeTextCellEditor",
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 2000, rows: 8, cols: 60 },
      },
    ],
    []
  );

  if (error) {
    return (
      <SitoGuard>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Errore nel caricamento delle recensioni: {error.message}</Alert>
        </Box>
      </SitoGuard>
    );
  }

  return (
    <SitoGuard>
      <ListToolbar
        onNew={handleNew}
        onDelete={handleDelete}
        disabledDelete={!selezionata}
        permissions={{ insertDenied: false, updateDenied: false, deleteDenied: false }}
      />
      <Box
        className="scrollable-box"
        sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(var(--app-height, 100dvh) - 64px - 48px)" }}
      >
        <Typography
          id="view-title"
          variant="h5"
          gutterBottom
        >
          Recensioni sito
        </Typography>

        {/* 🔴 L'avviso sta qui e non in una nota da qualche parte: chi compila questa pagina è
            esattamente la persona che deve saperlo, e questo è il momento in cui serve. */}
        <Alert
          severity="info"
          sx={{ mb: 2 }}
        >
          Sono <strong>citazioni</strong> di recensioni che i clienti hanno già scritto altrove: il sito non ne raccoglie. Vanno riportate <strong>fedelmente</strong> e attribuite — riscriverne il testo lasciandoci la firma di un cliente non è marketing, è una frase falsa attribuita a una persona reale.
          <br />
          Il punteggio medio e il numero di recensioni si impostano nelle <strong>impostazioni del sito</strong>, non qui.
        </Alert>

        <Datagrid<RecensioneVetrina>
          gridId="vetrina-recensioni"
          height="calc(100% - 130px)"
          items={recensioni}
          columnDefs={columnDefs}
          readOnly={false}
          loading={loading}
          hideToolbar
          getRowId={({ data }) => data.recensioneVetrinaId.toString()}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          onGridReady={handleGridReady}
          onCellValueChanged={handleCellValueChanged}
          onSelectionChanged={(event) => setSelezionata(event.api.getSelectedRows()[0] ?? null)}
        />
      </Box>
    </SitoGuard>
  );
}

export default RecensioniVetrinaList;
