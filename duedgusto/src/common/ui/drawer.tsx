export const getDrawerOpen = (): boolean => localStorage.getItem("drawer-open") === "1";

export const setDrawerOpen = (open: boolean) => {
  const int = open ? 1 : 0;
  localStorage.setItem("drawer-open", JSON.stringify(int));
};
