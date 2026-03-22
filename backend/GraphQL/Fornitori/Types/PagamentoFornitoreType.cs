using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.ChiusureMensili.Types;
using duedgusto.GraphQL.DataLoaders;

namespace duedgusto.GraphQL.Fornitori.Types;

public class PagamentoFornitoreType : ObjectGraphType<PagamentoFornitore>
{
    public PagamentoFornitoreType()
    {
        Name = "PagamentoFornitore";

        Field("pagamentoId", x => x.PagamentoId);
        Field("fatturaId", x => x.FatturaId, nullable: true);
        Field("ddtId", x => x.DdtId, nullable: true);
        Field("dataPagamento", x => x.DataPagamento, type: typeof(DateTimeGraphType));
        Field("importo", x => x.Importo);
        Field("metodoPagamento", x => x.MetodoPagamento, nullable: true);
        Field("note", x => x.Note, nullable: true);
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<FatturaAcquistoType>("fattura")
            .ResolveAsync(async context =>
            {
                var fk = context.Source.FatturaId;
                if (fk == null) return null;
                return await context.GetFatturaById(fk.Value).GetResultAsync();
            });

        Field<DocumentoTrasportoType>("ddt")
            .ResolveAsync(async context =>
            {
                var fk = context.Source.DdtId;
                if (fk == null) return null;
                return await context.GetDdtById(fk.Value).GetResultAsync();
            });

        Field<ListGraphType<SpesaMensileType>, IEnumerable<SpesaMensile>>("speseMensili")
            .Resolve(context => context.Source.SpeseMensili);
    }
}
