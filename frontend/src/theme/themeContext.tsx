import { createContext } from "react";

interface IThemeContext {
  theme: string,
  onChangeTheme: (themeMode: ThemeMode) => Promise<void>,
}

export const ThemeContext = createContext<IThemeContext>({
  theme: '',
  onChangeTheme: () => Promise.resolve(),
});