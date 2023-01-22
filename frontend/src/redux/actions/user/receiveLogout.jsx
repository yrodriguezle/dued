import { LOGOUT_USER } from '../types';

const receiveLogout = () => ({
  type: LOGOUT_USER,
  payload: null,
});

export default receiveLogout;
