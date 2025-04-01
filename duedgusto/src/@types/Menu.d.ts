type Menu = {
  __typename: "Menu";
  menuId: number;
  parentMenuId?: number;
  title: string;
  path: string;
  icon: string;
  isVisible: boolean;
  filePath?: string;
  viewName?: string;
} | null;
