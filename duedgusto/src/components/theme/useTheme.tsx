import { useEffect } from "react";
import useStore from "../../store/useStore";

function useTheme() {
  const { userTheme, changeTheme } = useStore((store) => store);

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
        changeTheme("default");
      }
    };
    handleChangeSystemTheme();

    const mediaQueryList: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQueryList.addEventListener("change", handleChangeSystemTheme);
    return () => {
      mediaQueryList.removeEventListener("change", handleChangeSystemTheme);
    };
  }, [changeTheme, userTheme.mode]);

  return {
    userTheme,
    changeTheme,
  };
}

export default useTheme;
