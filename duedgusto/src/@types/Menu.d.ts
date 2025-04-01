type Menu = {
  __typename: "Menu";
  menuId: number;
  title: string;
  path: string;
  icon: string;
  isVisible: boolean;
  parentMenuId?: number;
  filePath?: string;
  viewName?: string;
} | null;
