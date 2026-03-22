using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.Fornitori.Types;

public class FatturaAcquistoType : ObjectGraphType<FatturaAcquisto>
{
    public FatturaAcquistoType()
    {
        Name = "FatturaAcquisto";

        Field("fatturaId", x => x.FatturaId);
        Field("fornitoreId", x => x.FornitoreId);
        Field("numeroFattura", x => x.NumeroFattura);
        Field<DateTimeGraphType>("dataFattura").Resolve(x => x.Source.DataFattura);
        Field("imponibile", x => x.Imponibile);
        Field("importoIva", x => x.ImportoIva, nullable: true);
        Field("totaleConIva", x => x.TotaleConIva, nullable: true);
        Field("stato", x => x.Stato);
        Field<DateTimeGraphType>("dataScadenza").Resolve(x => x.Source.DataScadenza);
        Field("note", x => x.Note, nullable: true);
        Field<DateTimeGraphType>("creatoIl").Resolve(x => x.Source.CreatoIl);
        Field<DateTimeGraphType>("aggiornatoIl").Resolve(x => x.Source.AggiornatoIl);

        Field<FornitoreType>("fornitore")
            .ResolveAsync(async context =>
            {
                return await context.GetFornitoreById(context.Source.FornitoreId).GetResultAsync();
            });

        Field<ListGraphType<DocumentoTrasportoType>>("documentiTrasporto")
            .ResolveAsync(async context =>
            {
                return await context.GetDdtByFatturaId(context.Source.FatturaId).GetResultAsync();
            });

        Field<ListGraphType<PagamentoFornitoreType>>("pagamenti")
            .ResolveAsync(async context =>
            {
                return await context.GetPagamentiByFatturaId(context.Source.FatturaId).GetResultAsync();
            });
    }
}
