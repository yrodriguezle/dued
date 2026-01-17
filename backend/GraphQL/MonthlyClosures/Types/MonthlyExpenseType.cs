using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.Suppliers.Types;

namespace duedgusto.GraphQL.MonthlyClosures.Types;

public class MonthlyExpenseType : ObjectGraphType<SpesaMensile>
{
    public MonthlyExpenseType()
    {
        Name = "MonthlyExpense";

        Field("expenseId", x => x.SpesaId);
        Field("closureId", x => x.ChiusuraId);
        Field("paymentId", x => x.PagamentoId, nullable: true);
        Field("description", x => x.Descrizione);
        Field("amount", x => x.Importo);
        Field("category", x => x.Categoria, nullable: true);
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<MonthlyClosureType, ChiusuraMensile>("closure")
            .Resolve(context => context.Source.Chiusura);

        Field<SupplierPaymentType, PagamentoFornitore>("payment")
            .Resolve(context => context.Source.Pagamento);
    }
}
