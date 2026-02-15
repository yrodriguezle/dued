import React, { useState } from 'react';
import { Box, Typography, Button, Alert, CircularProgress, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router';
import { useQueryValidaCompletezzaRegistri } from '../../../graphql/chiusureMensili/queries';
import { mutationCreaChiusuraMensile } from '../../../graphql/chiusureMensili/mutations';
import dayjs from 'dayjs';

const MonthlyClosureForm: React.FC = () => {
  const navigate = useNavigate();
  const [anno, setAnno] = useState(dayjs().year());
  const [mese, setMese] = useState(dayjs().month() + 1);
  const [validating, setValidating] = useState(false);

  const { giorniMancanti, loading: validazioneLoading, refetch: refetchValidazione } = useQueryValidaCompletezzaRegistri({
    anno,
    mese,
    skip: !validating,
  });

  const [creaChiusura, { loading: creazioneLoading, error: creazioneError }] = useMutation(mutationCreaChiusuraMensile);

  const years = Array.from({ length: 10 }, (_, i) => dayjs().year() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleValidate = () => {
    setValidating(true);
    refetchValidazione();
  };

  const handleCreaChiusura = async () => {
    const result = await creaChiusura({
      variables: { anno, mese },
    });

    const chiusura = result.data?.monthlyClosures.creaChiusuraMensile;
    if (chiusura) {
      navigate(`/gestionale/cassa/monthly-closure/${chiusura.chiusuraId}`);
    }
  };

  const canCreate = validating && !validazioneLoading;

  return (
    <Box sx={{ padding: 3, maxWidth: 500 }}>
      <Typography variant="h5" gutterBottom>Nuova Chiusura Mensile</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Anno</InputLabel>
          <Select
            value={anno}
            label="Anno"
            onChange={(e: SelectChangeEvent<number>) => { setAnno(e.target.value as number); setValidating(false); }}
          >
            {years.map((y) => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Mese</InputLabel>
          <Select
            value={mese}
            label="Mese"
            onChange={(e: SelectChangeEvent<number>) => { setMese(e.target.value as number); setValidating(false); }}
          >
            {months.map((m) => (
              <MenuItem key={m} value={m}>
                {dayjs().month(m - 1).format('MMMM')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Button variant="outlined" onClick={handleValidate} disabled={validazioneLoading} sx={{ mb: 2 }}>
        {validazioneLoading ? <CircularProgress size={20} /> : 'Valida Completezza Registri'}
      </Button>

      {validating && !validazioneLoading && giorniMancanti.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ci sono {giorniMancanti.length} giorni mancanti. Potrai escluderli nella pagina di dettaglio prima della chiusura.
        </Alert>
      )}

      {validating && !validazioneLoading && giorniMancanti.length === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Tutti i registri giornalieri sono presenti e chiusi.
        </Alert>
      )}

      {creazioneError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Errore nella creazione: {creazioneError.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleCreaChiusura}
          disabled={!canCreate || creazioneLoading}
        >
          {creazioneLoading ? <CircularProgress size={20} /> : 'Crea Chiusura Mensile'}
        </Button>
        <Button variant="text" onClick={() => navigate('/gestionale/cassa/monthly-closure')}>
          Annulla
        </Button>
      </Box>
    </Box>
  );
};

export default MonthlyClosureForm;
