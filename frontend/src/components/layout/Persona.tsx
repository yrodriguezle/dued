import Avatar, { AvatarProps } from '@mui/material/Avatar';
import stringToColor from '../../common/ui/stringToColor';

function stringAvatar(name: string) {
  return {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
  };
}

interface PersonaProps extends AvatarProps {
  text: string
}

function Persona({
  text, ...otherProps
}: PersonaProps) {
  return (
    <Avatar
      {...stringAvatar(text)}
      {...otherProps}
    />
  );
}

export default Persona;
