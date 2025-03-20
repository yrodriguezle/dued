import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getLastActivity, hasRememberPassword, isAuthenticated } from '../../common/auth';
import { addMilliseconds, getCurrentDate, isDateBefore } from '../../common/date';
import logout from '../../redux/actions/user/logout';
import useMakeLogin from './useMakeLogin';

function useBootstrapUser() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const makeLogin = useMakeLogin();

  const logoutIfHasNotRememberPassword = useCallback(
    () => {
      const lastActivity = getLastActivity();
      if (isAuthenticated() && !hasRememberPassword() && lastActivity) {
        const lastActivityMoreExpiry = addMilliseconds({
          date: lastActivity,
          milliseconds: +global.LOGON_TIME * 1000,
        });
        const sessionExpired = isDateBefore({
          date: lastActivityMoreExpiry,
          threshold: getCurrentDate(),
        });
        if (sessionExpired) {
          dispatch(logout(navigate));
        }
        return true;
      }
      return false;
    },
    [dispatch, navigate],
  );

  return useCallback(
    async () => {
      const userGetLogout = logoutIfHasNotRememberPassword();
      if (!userGetLogout) {
        await makeLogin();
      }
    },
    [logoutIfHasNotRememberPassword, makeLogin],
  );
}

export default useBootstrapUser;
