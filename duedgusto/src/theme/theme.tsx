import { createTheme, PaletteMode } from '@mui/material/styles';

const theme = (mode: PaletteMode | undefined) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#ffab40',
    },
    secondary: {
      main: '#bf360c',
    },
  },
});

export default theme;
