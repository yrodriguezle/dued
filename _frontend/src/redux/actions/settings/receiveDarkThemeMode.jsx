import {
  RECEIVE_DARK_MODE,
} from '../types';

export default (payload) => ({
  type: RECEIVE_DARK_MODE,
  payload,
});
