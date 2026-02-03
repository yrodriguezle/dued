import React, { useMemo, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface MonthlyExpensesDataGridProps {
    expenses: SpesaMensileLibera[];
    onExpensesChange: (expenses: SpesaMensileLibera[]) => void;
    readOnly?: boolean;
}

const CATEGORIE_SPESA: CategoriaSpesa[] = ['Affitto', 'Utenze', 'Stipendi', 'Altro'];

const MonthlyExpensesDataGrid: React.FC<MonthlyExpensesDataGridProps> = ({ expenses, onExpensesChange, readOnly = false }) => {
    const gridApiRef = useRef<GridApi | null>(null);

    const onGridReady = useCallback((params: { api: GridApi }) => {
        gridApiRef.current = params.api;
    }, []);

    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        const updatedRow = event.data;
        const updatedExpenses = expenses.map(expense =>
            expense.spesaId === updatedRow.spesaId ? updatedRow : expense
        );
        onExpensesChange(updatedExpenses);
    }, [expenses, onExpensesChange]);

    const handleAddExpense = useCallback(() => {
        const newId = Math.min(0, ...expenses.map(e => e.spesaId)) - 1;
        const newExpense: SpesaMensileLibera = {
            __typename: "SpesaMensileLibera",
            spesaId: newId,
            chiusuraId: expenses.length > 0 ? expenses[0].chiusuraId : 0,
            descrizione: 'Nuova spesa',
            importo: 0,
            categoria: 'Altro',
            creatoIl: new Date().toISOString(),
            aggiornatoIl: new Date().toISOString(),
        };
        onExpensesChange([...expenses, newExpense]);
    }, [expenses, onExpensesChange]);

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'categoria',
            headerName: 'Categoria',
            editable: !readOnly,
            width: 150,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: CATEGORIE_SPESA
            }
        },
        { field: 'descrizione', headerName: 'Descrizione', editable: !readOnly, flex: 1 },
        {
            field: 'importo',
            headerName: 'Importo',
            editable: !readOnly,
            valueParser: params => Number(params.newValue),
            valueFormatter: (params) => params.value ? `€ ${Number(params.value).toFixed(2)}` : '€ 0.00',
            type: 'numericColumn',
            width: 120
        },
    ], [readOnly]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), []);

    return (
        <Paper elevation={3} sx={{ padding: 2, height: 400 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Spese Mensili Libere</Typography>
                {!readOnly && (
                    <Box>
                        <Button sx={{ mr: 1 }} onClick={handleAddExpense}>+ Aggiungi Spesa</Button>
                    </Box>
                )}
            </Box>
            <div className="ag-theme-alpine" style={{ height: 'calc(100% - 48px)', width: '100%' }}>
                <AgGridReact
                    rowData={expenses}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    onCellValueChanged={onCellValueChanged}
                    getRowId={(params) => String(params.data.spesaId)}
                />
            </div>
        </Paper>
    );
};

export default MonthlyExpensesDataGrid;
