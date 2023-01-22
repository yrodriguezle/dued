import { RESET_STATE } from './types';

const resetState = () => ({
  type: RESET_STATE,
  payload: null,
});

export default resetState;
