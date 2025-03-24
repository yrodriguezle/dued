import { create } from "zustand";
import userStore from "./userStore";
import inProgressStore from "./inProgressStore";
import sidebarStore from "./sidebarStore";
import themeStore from "./themeStore";

const useStore = create<Store>((set) => ({
  ...userStore(set),
  ...inProgressStore(set),
  ...sidebarStore(set),
  ...themeStore(set),
}));

export default useStore;
