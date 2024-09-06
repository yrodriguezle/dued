import { create } from 'zustand';
import userStore from './userStore';

const useStore = create<Store>((set) => ({
  ...userStore(set),
}));

export default useStore;