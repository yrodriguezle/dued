import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import appMessages from '../../../messages/appMessages';

function ViewAccessDenied() {
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const handleAccept = useCallback(
    () => {
      navigate(-1);
    },
    [navigate],
  );

  return (
    <div>{appMessages.accessDeniedDialog.body}</div>
  );
}

export default ViewAccessDenied;
