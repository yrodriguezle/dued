import { Typography } from "@mui/material";

function Copyright() {
  return (
    <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1, mb: 1, fontSize: "0.7rem" }}>
      {(window as Global).COPYRIGHT}
    </Typography>
  );
}

export default Copyright;
