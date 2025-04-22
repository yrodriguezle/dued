import { useCallback } from "react";

const useSubmitMenu = () => {
  const submitMenu = useCallback(async ({ menu }: { menu: { menuId: number; menuName: string; menuDescription: string } }) => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(menu);
      }, 1000);
    });
  }, []);

  return { submitMenu };
};

export default useSubmitMenu;
