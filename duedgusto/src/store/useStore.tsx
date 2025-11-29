import { create } from "zustand";
import userStore from "./userStore";
import inProgressStore from "./inProgressStore";
import themeStore from "./themeStore";
import confirmDialogStore from "./confirmDialogStore";
import serverStatusStore from "./serverStatusStore";
import businessSettingsStore from "./businessSettingsStore";

const useStore = create<Store>((set, get) => ({
  ...userStore(set),
  ...inProgressStore(set),
  ...themeStore(set),
  ...confirmDialogStore(set),
  ...serverStatusStore(set),
  ...businessSettingsStore(set, get),
}));

export default useStore;
