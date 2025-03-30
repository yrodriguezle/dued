type Menu = {
  __typename: "Menu";
  menuId: number;
  title: string;
  path: string;
  icon: string;
  isVisible: boolean;
  parentMenu?: Menu;
  children?: Menu[];
  roles?: Role[];
} | null;