import Avatar from "@mui/material/Avatar";
import Typography, { TypographyProps } from "@mui/material/Typography";
import logo from "../../../assets/img/1724879785967.jpg";

function LogoSection(props: TypographyProps) {
  return (
    <>
      <Avatar alt="2D Gusto" src={logo} />
      <Typography
        component="h1"
        variant="h4"
        sx={{
          marginLeft: 1,
          fontFamily: "BrunoAce Regular",
          color: (theme) => (theme.palette.mode === "light" ? theme.palette.secondary.light : theme.palette.primary.dark),
        }}
        {...props}
      >
        2d gusto
      </Typography>
    </>
  );
}

export default LogoSection;
