import getLazyIcon from "../../components/layout/sideBar/getLazyIcon";
import { MenuItem } from "../../components/layout/sideBar/NestedList";
import { navigateTo } from "../navigator/navigator";

const createMenuItem = (menu: Menu, menus: Menu[]): MenuItem => {
  const children = menus.filter((m) => m?.menuPadreId === menu?.id).sort((a, b) => (a?.posizione ?? 0) - (b?.posizione ?? 0));
  const path = menu?.percorso || "";
  return {
    label: menu?.titolo || "",
    icon: getLazyIcon(menu?.icona),
    path,
    onClick: path
      ? () => {
          navigateTo(menu?.percorso || "");
        }
      : undefined,
    children: children.length ? children.map((m) => createMenuItem(m, menus)) : undefined,
  };
};

function createDataTree(dataset: Menu[]): MenuItem[] {
  const paretns: Menu[] = dataset.filter((menu) => !menu?.menuPadreId).sort((a, b) => (a?.posizione ?? 0) - (b?.posizione ?? 0));
  return paretns.map((menu) => createMenuItem(menu, dataset));
}

export default createDataTree;
