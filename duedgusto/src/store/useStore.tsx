import { create } from "zustand";
import userStore from "./userStore";
import inProgressStore from "./inProgressStore";
import themeStore from "./themeStore";
import confirmDialogStore from "./confirmDialogStore";
import serverStatusStore from "./serverStatusStore";

const useStore = create<Store>((set) => ({
  ...userStore(set),
  ...inProgressStore(set),
  ...themeStore(set),
  ...confirmDialogStore(set),
  ...serverStatusStore(set),
}));

export default useStore;
