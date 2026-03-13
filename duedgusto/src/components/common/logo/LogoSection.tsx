import Avatar from "@mui/material/Avatar";
import Typography, { TypographyProps } from "@mui/material/Typography";
import Box from "@mui/material/Box";
import logo from "../../../assets/img/1724879785967.jpg";
import useStore from "../../../store/useStore";

function LogoSection(props: TypographyProps) {
  const businessName = useStore((store) => store.settings?.businessName);
  const displayName = businessName || (window as Global).BUSINESS_NAME || "DuedGusto";

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Avatar alt={displayName} src={logo} />
      <Typography
        component="h1"
        variant="h4"
        sx={{
          marginLeft: 1,
          fontFamily: "BrunoAce Regular",
          color: (theme) => (theme.palette.mode === "light" ? theme.palette.secondary.light : theme.palette.primary.light),
          display: { xs: "none", md: "block" },
        }}
        {...props}
      >
        {displayName}
      </Typography>
    </Box>
  );
}

export default LogoSection;
