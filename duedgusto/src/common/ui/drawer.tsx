export const getDrawerOpen = (): boolean => !!localStorage.getItem("drawer-open");

export const setDrawerOpen = (open: boolean) => {
  const int = open ? 1 : 0;
  localStorage.setItem("drawer-open", JSON.stringify(int));
};
