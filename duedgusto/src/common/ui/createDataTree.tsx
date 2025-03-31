import getLazyIcon from "../../components/layout/sideBar/getLazyIcon";
import { MenuItem } from "../../components/layout/sideBar/NestedList";
import { navigateTo } from "../navigator/navigator";

interface HashTable {
  [key: string]: MenuItem;
}

function createDataTree(dataset: Menu[]): MenuItem[] {
  const hashTable = dataset.reduce((accumulator, item) => {
    if (!item) {
      return accumulator;
    }
    const result: MenuItem = {
      label: item.title,
      icon: getLazyIcon(item.icon),
      path: item.path,
      onClick: () => navigateTo(item.path),
      children: item.parentMenuId ? [] : undefined,
    };
    return {
      ...accumulator,
      [item.menuId]: result,
    };
  }, {} as HashTable);

  const dataTree: MenuItem[] = [];

  dataset.forEach((aData) => {
    if (!aData) {
      return;
    }
    if (aData?.parentMenuId) {
      hashTable[aData.parentMenuId].children?.push(hashTable[aData.menuId]);
    } else {
      dataTree.push(hashTable[aData.menuId]);
    }
  });
  return dataTree;
}

export default createDataTree;
