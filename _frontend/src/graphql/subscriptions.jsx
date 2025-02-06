/* eslint-disable import/prefer-default-export */

import { userFragment } from './fragments';

export const USER_CHANGED_SUBSCRIPTION = (`
  ${userFragment}
  subscription onUserChanged {
    userChanged {
      ...UserFragment
    }
  }
`);
