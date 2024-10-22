import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

// import SidebarMenu from './SidebarMenu';
import { drawerWidth } from '../../../common/ui/constant';

function Sidebar({ drawerOpened, drawerToggle }) {
  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={drawerOpened}
        onClose={drawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        <Toolbar />
        <SidebarMenu />
      </Drawer>
      <Drawer
        variant="persistent"
        open={drawerOpened}
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        <Toolbar />
        <SidebarMenu />
      </Drawer>
    </Box>
  );
}

export default Sidebar;
