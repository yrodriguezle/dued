import { RECEIVE_USER } from '../types';

const receiveUser = (user) => ({
  type: RECEIVE_USER,
  payload: user,
});

export default receiveUser;
