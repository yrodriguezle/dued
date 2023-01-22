import React from 'react';
import Box from '@mui/material/Box';

import AuthBackground from './authentication/AuthBackground';
import AuthLogin from './authentication/AuthLogin';

function LoginPage() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--neutralLighterAlt)' }}>
      <AuthBackground />
      <div className="box">
        <div className="box-item">
          <AuthLogin />
        </div>
      </div>
    </Box>
  );
}

export default LoginPage;
