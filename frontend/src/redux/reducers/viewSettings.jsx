import { createAction, createReducer } from '@reduxjs/toolkit';
import {
  RESET_STATE,
  RESET_VIEW_SETTINGS,
  RECEIVE_VIEW_SETTINGS,
  RECEIVE_SET_VIEW_SETTINGS,
  RECEIVE_VIEWNAME_VIEW_SETTINGS,
} from '../actions/types';

const initialState = {
  viewSettings: {},
  setViewSetting: undefined,
  viewName: undefined,
};

const receivevViewSettings = (state, { payload }) => ({
  ...state,
  viewSettings: payload,
});
const receivevSetViewSettings = (state, { payload }) => ({
  ...state,
  setViewSetting: payload,
});
const receiveViewNameViewSettings = (state, { payload }) => ({
  ...state,
  viewName: payload,
});

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(RECEIVE_VIEW_SETTINGS),
      receivevViewSettings,
    )
    .addCase(
      createAction(RECEIVE_SET_VIEW_SETTINGS),
      receivevSetViewSettings,
    )
    .addCase(
      createAction(RECEIVE_VIEWNAME_VIEW_SETTINGS),
      receiveViewNameViewSettings,
    )
    .addCase(
      createAction(RESET_VIEW_SETTINGS),
      () => initialState,
    )
    .addCase(
      createAction(RESET_STATE),
      () => initialState,
    );
};

export default createReducer(initialState, functionsBuilder);
