import { createAction, createReducer } from '@reduxjs/toolkit';
import {
  RECEIVE_USER,
  LOGOUT_USER,
  RESET_STATE,
} from '../actions/types';

const initialState = null;

const receiveUser = (state, { payload }) => payload;

const logout = () => initialState;

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(RECEIVE_USER),
      receiveUser,
    )
    .addCase(
      createAction(LOGOUT_USER),
      logout,
    )
    .addCase(
      createAction(RESET_STATE),
      () => initialState,
    );
};

export default createReducer(initialState, functionsBuilder);
