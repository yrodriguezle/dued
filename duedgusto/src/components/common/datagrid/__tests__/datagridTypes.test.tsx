import { describe, it, expect } from "vitest";
import { DatagridStatus } from "../../../../common/globals/constants";
import { DatagridColDef, DatagridData } from "../@types/Datagrid";
import { withDatagridStatus, stripDatagridStatus } from "../datagridUtils";

/**
 * Canary type-level: verifica a compile-time (via `npm run ts:check`) che le
 * columnDefs siano blindate sui row type puri. Se una di queste asserzioni
 * smette di valere, tsc fallisce — i test runtime sotto sono solo di supporto.
 */

// Row type puro di dominio (nessuna index signature)
interface FornitoreCanary {
  nome: string;
  partitaIva: string;
}

interface RigaCanary {
  descrizione: string;
  importo: number;
  fornitore: FornitoreCanary;
}

// 1. Un `field` inesistente sul row type puro NON deve compilare
const colonnaInesistente: DatagridColDef<RigaCanary> = {
  // @ts-expect-error — "CAMPO_INESISTENTE" non è un path valido di DatagridData<RigaCanary>
  field: "CAMPO_INESISTENTE",
};

// 2. Un `field` valido del row type compila
const colonnaValida: DatagridColDef<RigaCanary> = { field: "importo" };

// 3. Il campo ausiliario "status" (DatagridAuxData) è indirizzabile come colonna
const colonnaStatus: DatagridColDef<RigaCanary> = { field: "status" };

// 4. I path annidati compilano
const colonnaAnnidata: DatagridColDef<RigaCanary> = { field: "fornitore.nome" };

// 5. Una colonna sintetica con solo `colId` (senza `field`) compila
const colonnaSintetica: DatagridColDef<RigaCanary> = { colId: "__rowNumber", valueGetter: (params) => params.data?.importo };

describe("datagrid type safety (canary)", () => {
  const columnDefs: DatagridColDef<RigaCanary>[] = [colonnaInesistente, colonnaValida, colonnaStatus, colonnaAnnidata, colonnaSintetica];

  it("le columnDefs canary sono definite", () => {
    expect(columnDefs).toHaveLength(5);
  });

  it("withDatagridStatus/stripDatagridStatus fanno un round-trip tipizzato senza perdita", () => {
    const riga: RigaCanary = {
      descrizione: "canary",
      importo: 42,
      fornitore: { nome: "ACME", partitaIva: "01234567890" },
    };

    // withDatagridStatus produce DatagridData<T> senza cast
    const wrapped: DatagridData<RigaCanary> = withDatagridStatus(riga, DatagridStatus.Unchanged);
    expect(wrapped.status).toBe(DatagridStatus.Unchanged);
    expect(wrapped.importo).toBe(42);

    // stripDatagridStatus restituisce il T originale, senza il campo ausiliario
    const unwrapped: RigaCanary = stripDatagridStatus(wrapped);
    expect(unwrapped).toEqual(riga);
    expect(Object.keys(unwrapped)).not.toContain("status");
  });
});
