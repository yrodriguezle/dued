import { SET_MENU } from '../types';

const drawerToggle = (opened) => ({
  type: SET_MENU,
  payload: opened,
});

export default drawerToggle;
