import { ClockCircleOutlined, HomeOutlined, LockOutlined, StarOutlined, UnorderedListOutlined } from "@ant-design/icons";

function sidebarStore(set: StoreSet) {
  return {
    sidebar: {
      isOpen: [],
      opened: true,
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
    },
    toggleSidebarOpened: () => set((store) => ({
      sidebar: {
        ...store.sidebar,
        opened: !store.sidebar.opened,
      }
    })),
    receiveSidebarMenuOpen: (payload: string) => set((store) => ({
      sidebar: {
        ...store.sidebar,
        isOpen: [payload],
      }
    })),
  };
}

export default sidebarStore;