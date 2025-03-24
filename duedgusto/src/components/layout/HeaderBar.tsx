import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";

import LogoSection from "../common/logo/LogoSection";
import ThemeMenuButton from "./headerBar/ThemeMenuButton";
import ProfileMenuButton from "./headerBar/ProfileMenuButton";

function HeaderBar() {
  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <LogoSection variant="h5" />
          <Box sx={{ marginLeft: "auto" }}>
            <ThemeMenuButton />
            <ProfileMenuButton />
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
export default HeaderBar;
