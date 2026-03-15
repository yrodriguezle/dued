using GraphQL.Types;
using duedgusto.Models;

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

        Field<FornitoreType, Fornitore>("fornitore")
            .Resolve(context => context.Source.Fornitore);

        Field<ListGraphType<DocumentoTrasportoType>, IEnumerable<DocumentoTrasporto>>("documentiTrasporto")
            .Resolve(context => context.Source.DocumentiTrasporto);

        Field<ListGraphType<PagamentoFornitoreType>, IEnumerable<PagamentoFornitore>>("pagamenti")
            .Resolve(context => context.Source.Pagamenti);
    }
}
