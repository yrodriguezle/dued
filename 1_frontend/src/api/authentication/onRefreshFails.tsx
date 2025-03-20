import { redirect } from 'react-router-dom';
import configureClient from '../../graphql/configureClient';
import useStore from '../../store/useStore';
import { removeAuthToken, removeLastActivity, removeRememberPassword } from '../../common/authentication/auth';
// import appMessages from '../../messages/appMessages';

async function onRefreshFails() {
  const { receiveUser } = useStore.getState();
  const client = configureClient();
  // await new Promise((resolve) => {
  //   setConfirmValues({
  //     hiddenConfirm: false,
  //     disabled: false,
  //     canDismiss: false,
  //     title: appMessages.token.title,
  //     subText: '',
  //     onAccept: () => resolve(true),
  //     messageAccept: appMessages.token.accept,
  //   });
  // });
  removeAuthToken();
  removeLastActivity();
  removeRememberPassword();
  receiveUser(null);
  if (location.pathname !== '/login') {
    if (client) {
      client.resetStore();
    }
    if (redirect) {
      redirect('/login');
    }
  }
}

export default onRefreshFails;
