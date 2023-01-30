import { createAction, createReducer } from '@reduxjs/toolkit';
import {
  HomeOutlined,
  StarOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  LockOutlined,
} from '@ant-design/icons';

import {
  RESET_STATE,
} from '../actions/types';

const initialState = {
  navGroup: [
    {
      id: 'home',
      type: 'group',
      children: [
        {
          id: 'home',
          title: 'Home',
          type: 'item',
          url: '/',
          icon: HomeOutlined,
          breadcrumbs: false,
        },
      ],
    },
    {
      id: 'favorites',
      type: 'group',
      children: [
        {
          id: 'favorites',
          title: 'Preferiti',
          type: 'collapse',
          icon: StarOutlined,
          children: [],
        },
      ],
    },
    {
      id: 'recent',
      type: 'group',
      children: [
        {
          id: 'recent',
          title: 'Recenti',
          type: 'collapse',
          icon: ClockCircleOutlined,
          children: [],
        },
      ],
    },
    {
      id: 'modules',
      type: 'group',
      children: [
        {
          id: 'modules',
          title: 'Moduli',
          type: 'collapse',
          icon: UnorderedListOutlined,
          children: [
            {
              id: 'security',
              title: 'Sicurezza',
              type: 'collapse',
              icon: LockOutlined,
              children: [
                {
                  id: 'modules',
                  title: 'Gestione moduli',
                  type: 'item',
                  url: '/security/modules',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const functionsBuilder = (builder) => {
  builder
    .addCase(
      createAction(RESET_STATE),
      () => initialState,
    );
};

export default createReducer(initialState, functionsBuilder);
