import { LOGOUT_USER } from '../actions/types';
import resetState from '../actions/resetState';

const middleware = ({ dispatch }) => (next) => (action) => {
  if (action.type === LOGOUT_USER) {
    dispatch(resetState());
  }
  return next(action);
};

export default middleware;
