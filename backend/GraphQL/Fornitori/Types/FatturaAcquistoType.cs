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
            .Resolve(context => context.GetFornitoreById(context.Source.FornitoreId));

        Field<ListGraphType<DocumentoTrasportoType>>("documentiTrasporto")
            .Resolve(context => context.GetDdtByFatturaId(context.Source.FatturaId));

        Field<ListGraphType<PagamentoFornitoreType>>("pagamenti")
            .Resolve(context => context.GetPagamentiByFatturaId(context.Source.FatturaId));
    }
}
