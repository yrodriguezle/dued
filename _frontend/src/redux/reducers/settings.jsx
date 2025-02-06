import { createAction, createReducer } from '@reduxjs/toolkit';
import { setIsDarkMode } from '../../common/theme';
import {
  RECEIVE_DARK_MODE,
} from '../actions/types';

const initialState = {
  darkTheme: false,
};

const receiveDarkMode = (state, { payload }) => {
  setIsDarkMode(payload);
  return ({
    ...state,
    darkTheme: payload,
  });
};

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(RECEIVE_DARK_MODE),
      receiveDarkMode,
    );
};

export default createReducer(initialState, functionsBuilder);
