import { getDefaultTheme } from "../components/theme/theme";

const defaultUserTheme: UserTheme = {
  mode: "default",
  theme: getDefaultTheme(),
};

function themeStore(set: StoreSet) {
  return {
    userTheme: defaultUserTheme,
    changeTheme: (theme: ThemeMode) => {
      if (theme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        set(() => ({
          userTheme: { mode: "dark", theme: "dark" },
        }));
        return;
      }
      if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        set(() => ({
          userTheme: { mode: "light", theme: "light" },
        }));
        return;
      }
      const defaultMode = getDefaultTheme();
      document.documentElement.setAttribute("data-theme", defaultMode);
      set(() => ({
        userTheme: { mode: "default", theme: defaultMode },
      }));
    },
  };
}

export default themeStore;
