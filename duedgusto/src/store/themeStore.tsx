import { getDefaultTheme, getLastUserThemeMode, setLastUserThemeMode } from "../components/theme/theme";

const defaultUserTheme = (): UserTheme => {
  const mode = getLastUserThemeMode();
  return {
    mode,
    theme: mode === "default" ? getDefaultTheme() : mode,
  };
};

function themeStore(set: StoreSet) {
  return {
    userTheme: defaultUserTheme(),
    changeTheme: (theme: ThemeMode) => {
      if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        setLastUserThemeMode("dark");
        set(() => ({
          userTheme: { mode: "dark", theme: "dark" },
        }));
        return;
      }
      if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        setLastUserThemeMode("light");
        set(() => ({
          userTheme: { mode: "light", theme: "light" },
        }));
        return;
      }
      const defaultMode = getDefaultTheme();
      document.documentElement.setAttribute("data-theme", defaultMode);
      setLastUserThemeMode("default");
      set(() => ({
        userTheme: { mode: "default", theme: defaultMode },
      }));
    },
  };
}

export default themeStore;
