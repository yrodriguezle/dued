import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

function LogoSection() {
  return (
    <ButtonBase disableRipple component={Link} to={(window as Global).ROOT_URL || ''}>
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
    </ButtonBase>
  );
}

export default LogoSection;
