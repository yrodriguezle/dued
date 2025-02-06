import { createAction, createReducer } from '@reduxjs/toolkit';
import {
  ON_IN_PROGRESS,
  OFF_IN_PROGRESS,
  RESET_STATE,
} from '../actions/types';

const initialState = {};

const onInProgress = (state, { payload }) => ({
  ...state,
  [payload]: true,
});

const offInProgress = (state, { payload }) => ({
  ...state,
  [payload]: false,
});

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(ON_IN_PROGRESS),
      onInProgress,
    )
    .addCase(
      createAction(OFF_IN_PROGRESS),
      offInProgress,
    )
    .addCase(
      createAction(RESET_STATE),
      () => initialState,
    );
};

export default createReducer(initialState, functionsBuilder);
