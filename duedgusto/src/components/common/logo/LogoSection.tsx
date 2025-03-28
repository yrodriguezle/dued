import Avatar from "@mui/material/Avatar";
import Typography, { TypographyProps } from "@mui/material/Typography";
import Box from "@mui/material/Box";
import logo from "../../../assets/img/1724879785967.jpg";

function LogoSection(props: TypographyProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Avatar alt="2D Gusto" src={logo} />
      <Typography
        component="h1"
        variant="h4"
        sx={{
          marginLeft: 1,
          fontFamily: "BrunoAce Regular",
          color: (theme) => (theme.palette.mode === "light" ? theme.palette.secondary.light : theme.palette.primary.light),
        }}
        {...props}
      >
        2d gusto
      </Typography>
    </Box>
  );
}

export default LogoSection;
