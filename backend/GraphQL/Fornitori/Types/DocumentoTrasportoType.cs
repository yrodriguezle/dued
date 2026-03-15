using GraphQL.Types;
using duedgusto.Models;

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

        Field<FornitoreType, Fornitore>("fornitore")
            .Resolve(context => context.Source.Fornitore);

        Field<FatturaAcquistoType, FatturaAcquisto>("fattura")
            .Resolve(context => context.Source.Fattura);

        Field<ListGraphType<PagamentoFornitoreType>, IEnumerable<PagamentoFornitore>>("pagamenti")
            .Resolve(context => context.Source.Pagamenti);
    }
}
