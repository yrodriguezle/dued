import { create } from 'zustand';
import userStore from './userStore';
import inProgressStore from './inProgressStore';

const useStore = create<Store>((set) => ({
  ...userStore(set),
  ...inProgressStore(set),
}));

export default useStore;