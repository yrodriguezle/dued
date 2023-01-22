import { ON_IN_PROGRESS } from '../types';

const onInProgress = (name) => ({
  type: ON_IN_PROGRESS,
  payload: name,
});

export default onInProgress;
