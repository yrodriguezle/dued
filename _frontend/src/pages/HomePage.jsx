import React from 'react';
import Box from '@mui/material/Box';
import MenuCard from '../components/commonComponents/MenuCard';

function HomePage() {
  return (
    <div style={{ padding: 10, height: '100%' }}>
      Home Page
      <Box sx={{ width: 300 }}>
        <MenuCard />
      </Box>
    </div>
  );
}

export default HomePage;
