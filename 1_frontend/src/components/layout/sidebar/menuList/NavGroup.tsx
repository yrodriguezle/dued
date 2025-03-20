import { useMemo } from 'react';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

import NavItem from './NavItem';
import NavCollapse from './NavCollapse';

interface NavGroupProps {

}

const NavGroup = ({ item }) => {
  const items = useMemo(() => item.children?.map((menu) => {
    switch (menu.type) {
      case 'collapse':
        return <NavCollapse key={menu.id} menu={menu} level={1} />;
      case 'item':
        return <NavItem key={menu.id} item={menu} level={1} />;
      default:
        return (
          <Typography key={menu.id} variant="h6" color="error" align="center">
            Menu Items Error
          </Typography>
        );
    }
  }), [item.children]);

  return (
    <>
      <List disablePadding>
        {items}
      </List>
      <Divider />
    </>
  );
};

export default NavGroup;
