using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.Fornitori.Types;

public class DocumentoTrasportoType : ObjectGraphType<DocumentoTrasporto>
{
    public DocumentoTrasportoType()
    {
        Name = "DocumentoTrasporto";

        Field("ddtId", x => x.DdtId);
        Field("fatturaId", x => x.FatturaId, nullable: true);
        Field("fornitoreId", x => x.FornitoreId);
        Field("numeroDdt", x => x.NumeroDdt);
        Field("dataDdt", x => x.DataDdt, type: typeof(DateTimeGraphType));
        Field("importo", x => x.Importo, nullable: true);
        Field("note", x => x.Note, nullable: true);
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<FornitoreType>("fornitore")
            .ResolveAsync(async context =>
            {
                return await context.GetFornitoreById(context.Source.FornitoreId).GetResultAsync();
            });

        Field<FatturaAcquistoType>("fattura")
            .ResolveAsync(async context =>
            {
                var fk = context.Source.FatturaId;
                if (fk == null) return null;
                return await context.GetFatturaById(fk.Value).GetResultAsync();
            });

        Field<ListGraphType<PagamentoFornitoreType>>("pagamenti")
            .ResolveAsync(async context =>
            {
                return await context.GetPagamentiByDdtId(context.Source.DdtId).GetResultAsync();
            });
    }
}
