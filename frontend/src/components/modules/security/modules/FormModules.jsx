import React from 'react';
import Grid from '@mui/material/Grid';

import FormikTextField from '../../../commonComponents/formComponents/FormikTextField';

function FormModules() {
  return (
    <>
      <Grid container spacing={1}>
        <Grid item lg={4}>
          <FormikTextField
            label="Modulo"
            placeholder="Modulo"
            name="moduleName"
            margin="normal"
            autoFocus
            fullWidth
          />
        </Grid>
      </Grid>
      <Grid container spacing={1}>
        <Grid item lg={8}>
          <FormikTextField
            label="Descrizione"
            placeholder="Descrizione"
            name="moduleDescription"
            margin="normal"
            fullWidth
          />
        </Grid>
      </Grid>
    </>
  );
}

export default FormModules;
