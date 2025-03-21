import { create } from 'zustand';
import userStore from './userStore';
import inProgressStore from './inProgressStore';
import sidebarStore from './sidebarStore';

const useStore = create<Store>((set) => ({
  ...userStore(set),
  ...inProgressStore(set),
  ...sidebarStore(set),
}));

export default useStore;