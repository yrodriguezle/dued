import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import offInProgress from '../../redux/actions/inProgress/offInProgress';
import onInProgress from '../../redux/actions/inProgress/onInProgress';
import receiveUser from '../../redux/actions/user/receiveUser';
import useCallbackGetLoggedUser from './useCallbackGetLoggedUser';
import useMakeLogout from './useMakeLogout';

function useMakeLogin() {
  const dispatch = useDispatch();
  const getLoggedUser = useCallbackGetLoggedUser();
  const logoutUser = useMakeLogout();

  return useCallback(
    async () => {
      try {
        dispatch(onInProgress('fetchUser'));
        const { data } = await getLoggedUser();
        if (data && 'account' in data) {
          const { account: { currentUser } } = data;
          dispatch(receiveUser(currentUser));
          return currentUser;
        }
        return null;
      } catch (error) {
        logoutUser();
        return null;
      } finally {
        dispatch(offInProgress('fetchUser'));
      }
    },
    [dispatch, getLoggedUser, logoutUser],
  );
}

export default useMakeLogin;
