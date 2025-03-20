import React from 'react';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

function LogoSection() {
  return (
    <ButtonBase disableRipple component={Link} to={global.ROOT_URL}>
      <Typography
        component="h1"
        variant="h3"
        sx={{
          marginLeft: 1, fontFamily: 'Yesteryear', color: (theme) => (theme.palette.mode === 'light' ? theme.palette.common.black : '#b26500'),
        }}
      >
        2D
      </Typography>
      <Typography
        component="h1"
        variant="h3"
        sx={{
          marginLeft: -8, fontFamily: 'Yesteryear', color: 'var(--fontColor)',
        }}
      >
        2D
      </Typography>
      <Typography component="h1" variant="h4" sx={{ marginLeft: 1, fontFamily: 'Yesteryear' }}>
        RistoPub
      </Typography>
    </ButtonBase>
  );
}

export default LogoSection;
