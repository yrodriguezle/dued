import { useCallback, useEffect, useState } from "react";
import { getLastUserTheme } from "../common/authentication/auth";


const getDefaultTheme = () => window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function useThemeDetector() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getLastUserTheme());
  const [darkMode, setDarkMode] = useState(getDefaultTheme() === "dark");

  useEffect(() => {
    const handleChangeSystemTheme = () => {
      if (themeMode === 'default') {
        const defaultMode = getDefaultTheme();
        document.documentElement.setAttribute("data-theme", defaultMode);
        setDarkMode(defaultMode === 'dark');
      }
      if (themeMode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        setDarkMode(true);
      }
      if (themeMode === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        setDarkMode(false);
      }
    };
    handleChangeSystemTheme();

    const mediaQueryList: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryList.addEventListener("change", handleChangeSystemTheme);
    return () => mediaQueryList.removeEventListener("change", handleChangeSystemTheme);
  }, [themeMode]);

  const onChangeTheme = useCallback(
    async (theme: ThemeMode) => {
      setThemeMode(theme);
    },
    [],
  );

  return {
    themeMode,
    darkMode,
    onChangeTheme,
  };
}

export default useThemeDetector;
