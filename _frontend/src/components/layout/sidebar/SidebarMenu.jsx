/* eslint-disable no-unused-vars */
import React from 'react';
import { useSelector } from 'react-redux';
import Typography from '@mui/material/Typography';
import PerfectScrollbar from 'react-perfect-scrollbar';
import {
  DashboardOutlined, LockOutlined, HighlightOutlined, BgColorsOutlined,
} from '@ant-design/icons';

import NavGroup from './menuList/NavGroup';

const dashboard = {
  id: 'dashboard',
  title: 'Dashboard',
  type: 'group',
  children: [
    {
      id: 'default',
      title: 'Dashboard',
      type: 'item',
      url: '/dued',
      icon: DashboardOutlined,
      breadcrumbs: false,
    },
  ],
};
const pages = {
  id: 'pages',
  title: 'Pages',
  caption: 'Pages Caption',
  type: 'group',
  children: [
    {
      id: 'authentication',
      title: 'Authentication',
      type: 'collapse',
      icon: LockOutlined,
      children: [
        {
          id: 'login3',
          title: 'Login',
          type: 'item',
          url: '/pages/login/login3',
          target: true,
        },
        {
          id: 'register3',
          title: 'Register',
          type: 'item',
          url: '/pages/register/register3',
          target: true,
        },
        {
          id: 'default',
          title: 'Dashboard',
          type: 'item',
          url: '/dashboard/default',
          icon: DashboardOutlined,
          breadcrumbs: false,
        },
      ],
    },
  ],
};
const utilities = {
  id: 'utilities',
  title: 'Utilities',
  type: 'group',
  children: [
    {
      id: 'util-typography',
      title: 'Typography',
      type: 'item',
      url: '/utils/util-typography',
      icon: HighlightOutlined,
      breadcrumbs: false,
    },
    {
      id: 'util-color',
      title: 'Color',
      type: 'item',
      url: '/utils/util-color',
      icon: BgColorsOutlined,
      breadcrumbs: false,
    },
    {
      id: 'util-shadow',
      title: 'Shadow',
      type: 'item',
      url: '/utils/util-shadow',
      breadcrumbs: false,
    },
    {
      id: 'icons',
      title: 'Icons',
      type: 'collapse',
      children: [
        {
          id: 'tabler-icons',
          title: 'Tabler Icons',
          type: 'item',
          url: '/icons/tabler-icons',
          breadcrumbs: false,
        },
        {
          id: 'material-icons',
          title: 'Material Icons',
          type: 'item',
          url: '/icons/material-icons',
          breadcrumbs: false,
        },
      ],
    },
  ],
};
const other = {
  id: 'sample-docs-roadmap',
  type: 'group',
  children: [
    {
      id: 'sample-page',
      title: 'Sample Page',
      type: 'item',
      url: '/sample-page',
      breadcrumbs: false,
    },
    {
      id: 'documentation',
      title: 'Documentation',
      type: 'item',
      url: 'https://codedthemes.gitbook.io/berry/',
      external: true,
      target: true,
    },
    {
      id: 'util-asdasdasd',
      title: 'Tree',
      type: 'collapse',
      icon: HighlightOutlined,
      breadcrumbs: false,
      children: [
        {
          id: 'util-typography',
          title: 'Typography',
          type: 'item',
          url: '/utils/util-typography',
          icon: HighlightOutlined,
          breadcrumbs: false,
        },
        {
          id: 'util-color',
          title: 'Color',
          type: 'item',
          url: '/utils/util-color',
          icon: BgColorsOutlined,
          breadcrumbs: false,
        },
        {
          id: 'util-shadow',
          title: 'Shadow',
          type: 'item',
          url: '/utils/util-shadow',
          breadcrumbs: false,
        },
        {
          id: 'icons',
          title: 'Icons',
          type: 'collapse',
          children: [
            {
              id: 'tabler-icons',
              title: 'Tabler Icons',
              type: 'item',
              url: '/icons/tabler-icons',
              breadcrumbs: false,
            },
            {
              id: 'material-icons',
              title: 'Material Icons',
              type: 'item',
              url: '/icons/material-icons',
              breadcrumbs: false,
            },
          ],
        },
      ],
    },
  ],
};

// const menuItems = {
//   items: [dashboard, pages, utilities, other],
// };

function SidebarMenu() {
  const sidebar = useSelector((state) => state.sidebar);
  return (
    <PerfectScrollbar component="div">
      {sidebar.navGroup.map((item) => (item.type === 'group'
        ? <NavGroup key={item.id} item={item} /> : (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Menu Items Error
          </Typography>
        )))}
    </PerfectScrollbar>
  );
}

export default SidebarMenu;
