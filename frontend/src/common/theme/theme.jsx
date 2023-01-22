import { createTheme } from '@mui/material/styles';

const theme = (mode) => createTheme({
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
