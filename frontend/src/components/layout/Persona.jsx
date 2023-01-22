import React from 'react';
import Avatar from '@mui/material/Avatar';
import { stringToColor } from '../../common/uiHelpers';

function stringAvatar(name) {
  return {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
  };
}

function Persona({
  text, ...otherProps
}) {
  return (
    <Avatar
      {...stringAvatar(text)}
      {...otherProps}
    />
  );
}

export default Persona;
