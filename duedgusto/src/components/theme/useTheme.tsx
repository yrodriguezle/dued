import { useCallback, useEffect, useState } from "react";

const getDefaultTheme = () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function useTheme() {
  const [userTheme, setUserTheme] = useState<UserTheme>({ mode: "default", theme: getDefaultTheme() });

  useEffect(() => {
    const favicon = document.getElementById("favicon") as HTMLLinkElement;
    if (!favicon) {
      return;
    }
    if (userTheme.theme === "dark") {
      favicon.href = "/src/assets/img/logo_to_dark.png";
    } else {
      favicon.href = "/src/assets/img/logo_to_light.png";
    }
  }, [userTheme.theme]);

  useEffect(() => {
    const handleChangeSystemTheme = () => {
      if (userTheme.mode === "default") {
        const defaultMode = getDefaultTheme();
        document.documentElement.setAttribute("data-theme", defaultMode);
        setUserTheme({ mode: "default", theme: defaultMode });
      }
      if (userTheme.mode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        setUserTheme({ mode: "default", theme: "dark" });
      }
      if (userTheme.mode === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        setUserTheme({ mode: "default", theme: "light" });
      }
    };
    handleChangeSystemTheme();

    const mediaQueryList: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryList.addEventListener("change", handleChangeSystemTheme);
    return () => mediaQueryList.removeEventListener("change", handleChangeSystemTheme);
  }, [userTheme.mode]);

  const onChangeTheme = useCallback(async (theme: ThemeMode) => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setUserTheme({ mode: "dark", theme: "dark" });
      return;
    }
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      setUserTheme({ mode: "light", theme: "light" });
      return;
    }
    const defaultMode = getDefaultTheme();
    document.documentElement.setAttribute("data-theme", defaultMode);
    setUserTheme({ mode: "default", theme: defaultMode });
  }, []);

  return {
    userTheme,
    onChangeTheme,
  };
}

export default useTheme;
