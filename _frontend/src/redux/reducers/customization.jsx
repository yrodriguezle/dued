import { createAction, createReducer } from '@reduxjs/toolkit';
import {
  SET_MENU,
  MENU_OPEN,
  RESET_STATE,
} from '../actions/types';

const initialState = {
  isOpen: [], // for active default menu
  opened: true,
};

const drawerToggle = (state, { payload }) => ({
  ...state,
  opened: payload,
});

const menuOpen = (state, { payload }) => ({
  ...state,
  isOpen: [payload],
});

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(SET_MENU),
      drawerToggle,
    )
    .addCase(
      createAction(MENU_OPEN),
      menuOpen,
    )
    .addCase(
      createAction(RESET_STATE),
      () => initialState,
    );
};

export default createReducer(initialState, functionsBuilder);
