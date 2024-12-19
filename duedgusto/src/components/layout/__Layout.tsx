import { Outlet } from "react-router-dom"
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Header from "./Header";

function Layout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--neutralLighterAlt)' }}>
      <CssBaseline />
      <Header />
      <div style={{ marginTop: 64 }}>
        Layout
        <Outlet />
      </div>
    </Box>
  )
}

export default Layout