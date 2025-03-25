import Typography, { TypographyProps } from "@mui/material/Typography";

function LogoSection(props: TypographyProps) {
  return (
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
      2D Gusto
    </Typography>
  );
}

export default LogoSection;
