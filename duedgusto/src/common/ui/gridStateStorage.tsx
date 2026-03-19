import { ColumnState } from "ag-grid-community";

interface GridColumnStateMap {
  [gridId: string]: ColumnState[];
}

const STORAGE_KEY = "gridColumnState";

const readStorage = (): GridColumnStateMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    return JSON.parse(raw) as GridColumnStateMap;
  } catch {
    return {};
  }
};

export const getGridColumnState = (gridId: string): ColumnState[] | null => {
  const map = readStorage();
  return map[gridId] || null;
};

export const setGridColumnState = (gridId: string, state: ColumnState[]): void => {
  try {
    const map = readStorage();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...map,
        [gridId]: state,
      })
    );
  } catch {
    // localStorage pieno o non disponibile — fallback silenzioso
  }
};

export const removeGridColumnState = (gridId: string): void => {
  try {
    const map = readStorage();
    delete map[gridId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // fallback silenzioso
  }
};
