import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Paper } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { supplierFragment } from "../../../graphql/suppliers/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import { useMutation } from "@apollo/client";
import { mutationDeleteSupplier } from "../../../graphql/suppliers/mutations";

type SupplierNonNull = Exclude<Supplier, null>;

function SupplierList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<SupplierNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<SupplierNonNull>[]>([]);
  const onConfirm = useConfirm();

  const [deleteSupplier] = useMutation(mutationDeleteSupplier);

  useEffect(() => {
    setTitle("Fornitori");
  }, [setTitle]);

  const { data: suppliers, refetch } = useGetAll<SupplierNonNull>({
    fragment: supplierFragment,
    queryName: "suppliers",
    fragmentBody: "...SupplierFragment",
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<SupplierNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/suppliers-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un fornitore da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} fornitore/i selezionato/i?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) {
      return;
    }

    try {
      for (const row of selectedRows) {
        await deleteSupplier({
          variables: { supplierId: row.supplierId },
        });
      }

      showToast({
        type: "success",
        position: "bottom-right",
        message: `${selectedRows.length} fornitore/i eliminato/i con successo`,
        autoClose: 2000,
        toastId: "success-delete",
      });

      refetch();
    } catch {
      showToast({
        type: "error",
        position: "bottom-right",
        message: "Errore durante l'eliminazione",
        autoClose: 2000,
        toastId: "error-delete",
      });
    }
  }, [selectedRows, onConfirm, deleteSupplier, refetch]);

  const handleRowDoubleClick = useCallback((event: DatagridRowDoubleClickedEvent<SupplierNonNull>) => {
    if (event.data) {
      navigate(`/gestionale/suppliers-details?supplierId=${event.data.supplierId}`);
    }
  }, [navigate]);

  const columnDefs = useMemo<DatagridColDef<SupplierNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "supplierId",
        width: 80,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Ragione Sociale",
        field: "businessName",
        width: 250,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "P.IVA",
        field: "vatNumber",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Codice Fiscale",
        field: "fiscalCode",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Email",
        field: "email",
        width: 200,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Telefono",
        field: "phone",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Città",
        field: "city",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Stato",
        field: "active",
        width: 100,
        cellRenderer: (params: { value: boolean }) => {
          return (
            <Chip
              label={params.value ? "Attivo" : "Disattivo"}
              color={params.value ? "success" : "default"}
              size="small"
            />
          );
        },
      },
    ],
    []
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ListToolbar
        onNew={handleNew}
        onDelete={handleDelete}
        disabledDelete={selectedRows.length === 0}
      />

      <Paper sx={{ flex: 1, overflow: "hidden", mt: 2 }}>
        <Datagrid<SupplierNonNull>
          presentation
          height="100%"
          items={suppliers}
          columnDefs={columnDefs}
          getRowId={({ data }) => data.supplierId.toString()}
          rowSelection={{
            mode: "multiRow",
            headerCheckbox: true,
          }}
          onGridReady={handleGridReady}
          onRowDoubleClicked={handleRowDoubleClick}
        />
      </Paper>
    </Box>
  );
}

export default SupplierList;
