import getLazyIcon from "../../components/layout/sideBar/getLazyIcon";
import { MenuItem } from "../../components/layout/sideBar/NestedList";
import { navigateTo } from "../navigator/navigator";

const createMenuItem = (menu: Menu, menus: Menu[]): MenuItem => {
  const children = menus.filter((m) => m?.parentMenuId === menu?.menuId);
  const path = menu?.path || "";
  return {
    label: menu?.title || "",
    icon: getLazyIcon(menu?.icon),
    path,
    onClick: path ? () => navigateTo(menu?.path || "") : undefined,
    children: children.length ? children.map((m) => createMenuItem(m, menus)) : undefined,
  };
};

function createDataTree(dataset: Menu[]): MenuItem[] {
  const paretns: Menu[] = dataset.filter((menu) => !menu?.parentMenuId);
  return paretns.map((menu) => createMenuItem(menu, dataset));
}

export default createDataTree;
