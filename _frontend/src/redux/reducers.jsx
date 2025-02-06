import { combineReducers } from '@reduxjs/toolkit';
import sidebar from './reducers/sidebar';
import customization from './reducers/customization';
import inProgress from './reducers/inProgress';
import settings from './reducers/settings';
import user from './reducers/user';
import viewSettings from './reducers/viewSettings';

const rootReducer = combineReducers({
  sidebar,
  customization,
  inProgress,
  settings,
  user,
  viewSettings,
});

export default rootReducer;
