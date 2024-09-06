import { createTheme } from "@fluentui/react";

const darkTheme = createTheme({
  palette: {
    themePrimary: '#92cbf7',
    themeLighterAlt: '#06080a',
    themeLighter: '#172128',
    themeLight: '#2c3d4a',
    themeTertiary: '#587a94',
    themeSecondary: '#80b3da',
    themeDarkAlt: '#9dd0f8',
    themeDark: '#acd8f9',
    themeDarker: '#c1e2fb',
    neutralLighterAlt: '#272d2f',
    neutralLighter: '#262c2e',
    neutralLight: '#252b2c',
    neutralQuaternaryAlt: '#222829',
    neutralQuaternary: '#212628',
    neutralTertiaryAlt: '#202426',
    neutralTertiary: '#3b3b3b',
    neutralSecondary: '#767676',
    neutralSecondaryAlt: '#767676',
    neutralPrimaryAlt: '#adadad',
    neutralPrimary: '#c4c4c4',
    neutralDark: '#d2d2d2',
    black: '#dedede',
    white: '#282e30',
  },
  semanticColors: {
    errorBackground: 'rgb(68, 39, 38)',
    errorIcon: 'rgb(241, 112, 123)',
    messageText: '#f2f0f0',
    errorText: '#b02323',
    successBackground: 'hsl(88, 62%, 37%)',
    successIcon: '#0d6309',
  },
});

export default darkTheme;
