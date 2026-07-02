import { DatagridStatus } from "../../../common/globals/constants";
import { DatagridData } from "./@types/Datagrid";

/**
 * Aggiunge il campo ausiliario `status` a un item di dominio, producendo la riga
 * completa attesa dalla griglia. Nessun cast: `T & { status }` È `DatagridData<T>`.
 *
 * Caveat: il row type `T` NON deve dichiarare una propria proprietà `status`
 * (verrebbe sovrascritta qui e rimossa da `stripDatagridStatus`).
 */
export function withDatagridStatus<T extends object>(item: T, status: DatagridStatus): DatagridData<T> {
  return { ...item, status };
}

/**
 * Rimuove il campo ausiliario `status` da una riga della griglia, restituendo
 * l'item di dominio originale.
 */
export function stripDatagridStatus<T extends object>(data: DatagridData<T>): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { status: _status, ...rest } = data;
  // Cast documentato: TS non può provare Omit<DatagridData<T>, "status"> ≡ T per T generico.
  // Vale finché T non dichiara una propria proprietà `status` (vietato dai row types).
  return rest as T;
}

export const hiddenColumnProperties = {
  hide: true,
  editable: false,
  suppressColumnsToolPanel: true,
  suppressFiltersToolPanel: true,
  suppressHeaderMenuButton: true,
};
