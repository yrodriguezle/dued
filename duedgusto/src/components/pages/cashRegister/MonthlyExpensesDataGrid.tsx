import React, { useMemo, useCallback, useRef } from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, CellValueChangedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface MonthlyExpensesDataGridProps {
    expenses: MonthlyExpense[];
    onExpensesChange: (expenses: MonthlyExpense[]) => void;
}

const MonthlyExpensesDataGrid: React.FC<MonthlyExpensesDataGridProps> = ({ expenses, onExpensesChange }) => {
    const gridApiRef = useRef<GridApi | null>(null);

    const onGridReady = useCallback((params: { api: GridApi }) => {
        gridApiRef.current = params.api;
    }, []);

    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        // The event.data contains the whole row data after the change
        const updatedRow = event.data;
        const updatedExpenses = expenses.map(expense => 
            expense.id === updatedRow.id ? updatedRow : expense
        );
        onExpensesChange(updatedExpenses);
    }, [expenses, onExpensesChange]);

    const handleAddExpense = useCallback(() => {
        const newId = Math.min(0, ...expenses.map(e => e.id)) - 1; // Temporary negative ID
        const newExpense: MonthlyExpense = {
            id: newId,
            closureId: expenses.length > 0 ? expenses[0].closureId : 0, // Assume same closure
            description: 'Nuova spesa',
            amount: 0,
            category: 'ALTRO',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            paymentId: null,
            payment: null,
            __typename: "MonthlyExpense",
        };
        onExpensesChange([...expenses, newExpense]);
    }, [expenses, onExpensesChange]);

    const columnDefs = useMemo<ColDef[]>(() => [
        { field: 'category', headerName: 'Categoria', editable: true, width: 150,
          cellEditor: 'agSelectCellEditor', cellEditorParams: {
            values: ['FORNITORE', 'AFFITTO', 'UTENZE', 'ALTRO']
          }
        },
        { field: 'description', headerName: 'Descrizione', editable: true, flex: 1 },
        {
            field: 'amount',
            headerName: 'Importo',
            editable: true,
            valueParser: params => Number(params.newValue),
            valueFormatter: (params) => params.value ? `€ ${Number(params.value).toFixed(2)}` : '€ 0.00',
            type: 'numericColumn',
            width: 120
        },
        {
            field: 'paymentId',
            headerName: 'Pagamento',
            width: 120,
            valueFormatter: (params) => params.value ? `Pag. #${params.value}` : '-'
        },
    ], []);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
    }), []);

    return (
        <Paper elevation={3} sx={{ padding: 2, height: 400 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Spese Mensili Aggiuntive</Typography>
                <Box>
                    <Button sx={{ mr: 1 }} onClick={handleAddExpense}>+ Aggiungi Spesa</Button>
                    <Button variant="outlined">Importa da Pagamenti</Button>
                </Box>
            </Box>
            <div className="ag-theme-alpine" style={{ height: 'calc(100% - 48px)', width: '100%' }}>
                <AgGridReact
                    rowData={expenses}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    onCellValueChanged={onCellValueChanged}
                    getRowId={(params) => params.data.id}
                />
            </div>
        </Paper>
    );
};

export default MonthlyExpensesDataGrid;
