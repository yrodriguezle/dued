import { useApolloClient } from '@apollo/client';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { removeAuthToken, removeLastActivity } from '../../common/auth';
import { LOGOUT_USER } from '../../redux/actions/types';

const receiveLogout = () => ({
  type: LOGOUT_USER,
  payload: null,
});

function useMakeLogout() {
  const client = useApolloClient();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  return useCallback(
    () => {
      removeAuthToken();
      removeLastActivity();
      dispatch(receiveLogout());
      if (client) {
        client.resetStore();
      }
      if (navigate) {
        navigate('/login');
      } else {
        window.location.reload();
      }
    },
    [client, dispatch, navigate],
  );
}

export default useMakeLogout;
