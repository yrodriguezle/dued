import React, { useState, useContext, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { useNavigate } from 'react-router';
import { useQueryMonthlyClosures } from '../../../graphql/monthlyClosure/queries';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import dayjs from 'dayjs';

const MonthlyClosureList: React.FC = () => {
    const navigate = useNavigate();
    const { setTitle } = useContext(PageTitleContext);
    const [year, setYear] = useState(dayjs().year());

    useEffect(() => {
        setTitle('Chiusure Mensili');
    }, [setTitle]);

    const { monthlyClosures, loading, error } = useQueryMonthlyClosures({ year });

    const handleYearChange = (event: SelectChangeEvent<number>) => {
        setYear(event.target.value as number);
    };

    const handleNavigateToDetails = (closure: MonthlyClosure) => {
        navigate(`/gestionale/cassa/monthly-closure/${closure.id}`);
    };

    const years = Array.from({ length: 10 }, (_, i) => dayjs().year() - i);

    return (
        <Box sx={{ padding: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Chiusure Mensili</Typography>
                <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel id="year-select-label">Anno</InputLabel>
                    <Select
                        labelId="year-select-label"
                        id="year-select"
                        value={year}
                        label="Anno"
                        onChange={handleYearChange}
                    >
                        {years.map((y) => (
                            <MenuItem key={y} value={y}>{y}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {loading && <CircularProgress />}
            {error && <Alert severity="error">Errore nel caricamento delle chiusure mensili: {error.message}</Alert>}

            {!loading && !error && (
                <List>
                    {monthlyClosures.length === 0 ? (
                        <ListItem>
                            <ListItemText primary="Nessuna chiusura mensile trovata per l'anno selezionato." />
                        </ListItem>
                    ) : (
                        monthlyClosures.map((closure) => (
                            <ListItem key={closure.id} disablePadding>
                                <ListItemButton onClick={() => handleNavigateToDetails(closure)}>
                                    <ListItemText
                                        primary={`Chiusura di ${dayjs().month(closure.month - 1).format('MMMM')} ${closure.year}`}
                                        secondary={`Stato: ${closure.status} - Ricavo Netto: €${closure.netRevenue?.toFixed(2) ?? 'N/A'}`}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))
                    )}
                </List>
            )}
        </Box>
    );
};

export default MonthlyClosureList;
