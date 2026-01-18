using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Suppliers.Types;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class MonthlyExpenseType : ObjectGraphType<SpesaMensile>
{
    public MonthlyExpenseType()
    {
        Name = "SpesaMensile";

        Field("spesaId", x => x.SpesaId);
        Field("chiusuraId", x => x.ChiusuraId);
        Field("pagamentoId", x => x.PagamentoId, nullable: true);
        Field("descrizione", x => x.Descrizione);
        Field("importo", x => x.Importo);
        Field("categoria", x => x.Categoria, nullable: true);
        Field("creatoIl", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("aggiornatoIl", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<MonthlyClosureType, ChiusuraMensile>("chiusura")
            .Resolve(context => context.Source.Chiusura);

        Field<SupplierPaymentType, PagamentoFornitore>("pagamento")
            .Resolve(context => context.Source.Pagamento);
    }
}
