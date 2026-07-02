import { SearchboxColDef } from "../../../../@types/searchbox";
import { DatagridColDef } from "../../datagrid/@types/Datagrid";

/**
 * Converte una SearchboxColDef<T> in una DatagridColDef<T> (= ColDef<DatagridData<T>>),
 * omettendo i campi searchbox-specifici `graphField` e `action` che non esistono in ColDef.
 *
 * Cast documentato (unico del modulo searchbox): la conversione ColDef<T> → ColDef<DatagridData<T>>
 * è sound — le callback di ColDef sono contravarianti sul dato e DatagridData<T> = DatagridAuxData & T
 * è un sottotipo di T, e i path di `field` validi per T sono un sottoinsieme di quelli validi per
 * DatagridData<T> — ma TypeScript non può dimostrarlo per T generico, quindi serve l'asserzione.
 */
export function toDatagridColDef<T extends object>(col: SearchboxColDef<T>): DatagridColDef<T> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { graphField: _graphField, action: _action, ...rest } = col;
  return rest as DatagridColDef<T>;
}
