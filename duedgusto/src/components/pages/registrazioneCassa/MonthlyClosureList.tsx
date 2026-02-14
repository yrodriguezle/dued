import React, { useState, useContext, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent, Paper, Grid } from '@mui/material';
import { useNavigate } from 'react-router';
import { useQueryChiusureMensili } from '../../../graphql/chiusureMensili/queries';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import dayjs from 'dayjs';

const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const getStatusColor = (stato?: string) => {
    switch (stato) {
        case 'CHIUSA': return 'success.main';
        case 'RICONCILIATA': return 'info.main';
        case 'BOZZA': return 'warning.main';
        default: return 'transparent';
    }
};

const getStatusBg = (stato?: string) => {
    switch (stato) {
        case 'CHIUSA': return 'success.light';
        case 'RICONCILIATA': return 'info.light';
        case 'BOZZA': return 'warning.light';
        default: return 'action.hover';
    }
};

const MonthlyClosureList: React.FC = () => {
    const navigate = useNavigate();
    const { setTitle } = useContext(PageTitleContext);
    const [year, setYear] = useState(dayjs().year());

    useEffect(() => {
        setTitle('Chiusure Mensili');
    }, [setTitle]);

    const { chiusureMensili, loading, error } = useQueryChiusureMensili({ anno: year });

    const handleYearChange = (event: SelectChangeEvent<number>) => {
        setYear(event.target.value as number);
    };

    const closureByMonth = new Map<number, ChiusuraMensile>();
    chiusureMensili.forEach(c => closureByMonth.set(c.mese, c));

    const handleMonthClick = (month: number) => {
        const closure = closureByMonth.get(month);
        if (closure) {
            navigate(`/gestionale/cassa/monthly-closure/${closure.chiusuraId}`);
        } else {
            navigate(`/gestionale/cassa/monthly-closure/new?anno=${year}&mese=${month}`);
        }
    };

    const years = Array.from({ length: 10 }, (_, i) => dayjs().year() - i);

    return (
        <Box sx={{ padding: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
                <>
                    {/* Legenda */}
                    <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
                            <Typography variant="caption">Chiusa</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
                            <Typography variant="caption">Bozza</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'info.main' }} />
                            <Typography variant="caption">Riconciliata</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', border: '1px dashed grey' }} />
                            <Typography variant="caption">Non creata</Typography>
                        </Box>
                    </Box>

                    {/* Griglia calendario mesi */}
                    <Grid container spacing={2}>
                        {MONTH_NAMES.map((monthName, index) => {
                            const monthNumber = index + 1;
                            const closure = closureByMonth.get(monthNumber);
                            const isFuture = year === dayjs().year() && monthNumber > dayjs().month() + 1;

                            return (
                                <Grid item xs={6} sm={4} md={3} key={monthNumber}>
                                    <Paper
                                        elevation={closure ? 3 : 1}
                                        onClick={() => !isFuture && handleMonthClick(monthNumber)}
                                        sx={{
                                            p: 2,
                                            minHeight: 120,
                                            cursor: isFuture ? 'default' : 'pointer',
                                            opacity: isFuture ? 0.4 : 1,
                                            borderLeft: 4,
                                            borderColor: getStatusColor(closure?.stato),
                                            bgcolor: closure ? getStatusBg(closure.stato) : 'background.paper',
                                            transition: 'transform 0.15s, box-shadow 0.15s',
                                            '&:hover': !isFuture ? {
                                                transform: 'translateY(-2px)',
                                                boxShadow: 4,
                                            } : {},
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography variant="h6" fontWeight="bold">
                                            {monthName}
                                        </Typography>

                                        {closure ? (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {closure.stato}
                                                </Typography>
                                                <Typography variant="body2" fontWeight="bold">
                                                    € {closure.ricavoNettoCalcolato.toFixed(2)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {closure.registriInclusi.length} registri
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">
                                                {isFuture ? 'Mese futuro' : 'Nessuna chiusura'}
                                            </Typography>
                                        )}
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                </>
            )}
        </Box>
    );
};

export default MonthlyClosureList;
