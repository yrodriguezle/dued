import { OFF_IN_PROGRESS } from '../types';

const offInProgress = (name) => ({
  type: OFF_IN_PROGRESS,
  payload: name,
});

export default offInProgress;
