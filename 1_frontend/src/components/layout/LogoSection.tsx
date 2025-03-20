import Typography from '@mui/material/Typography';
// import ButtonBase from '@mui/material/ButtonBase';
// import { Link } from 'react-router-dom';

function LogoSection() {
  return (
    <Typography
      component="h1"
      variant="h4"
      sx={{
        marginLeft: 1,
        fontFamily: 'BrunoAce Regular',
        color: (theme) => (theme.palette.mode === 'light'
          ? theme.palette.secondary.light
          : theme.palette.primary.dark)
      }}
    >
      2D Gusto
    </Typography>
    // <ButtonBase disableRipple component={Link} to={(window as Global).ROOT_URL || ''}>
    // </ButtonBase>
  );
}

export default LogoSection;
