import { useCallback, useState } from "react";
import { IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import useSignOut from "../../../common/authentication/useSignOut";
import LogoutIcon from "@mui/icons-material/Logout";
import Persona from "./Persona";
import useStore from "../../../store/useStore";
import { useNavigate } from "react-router";

function ProfileMenuButton() {
  const utente = useStore((store) => store.utente);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const signOut = useSignOut();
  const navigate = useNavigate();

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleNavigateToProfile = useCallback(() => {
    handleCloseUserMenu();
    navigate("/gestionale/profilo");
  }, [navigate]);

  return (
    <>
      <Tooltip title="Impostazioni">
        <IconButton
          onClick={handleOpenUserMenu}
          sx={{ p: 0 }}
        >
          <Persona
            alt={`${utente?.nome} ${utente?.cognome}`}
            text={`${utente?.nome} ${utente?.cognome}`}
          />
        </IconButton>
      </Tooltip>
      <Menu
        sx={{ mt: "45px" }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <MenuItem onClick={handleNavigateToProfile}>
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ textAlign: "center" }}>Profilo</Typography>
        </MenuItem>
        <MenuItem onClick={signOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <Typography sx={{ textAlign: "center" }}>Esci</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}

export default ProfileMenuButton;
