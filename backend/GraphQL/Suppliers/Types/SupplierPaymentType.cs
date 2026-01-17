using GraphQL.Types;
using duedgusto.Models;
using duedgusto.GraphQL.MonthlyClosures.Types;

namespace duedgusto.GraphQL.Suppliers.Types;

public class SupplierPaymentType : ObjectGraphType<PagamentoFornitore>
{
    public SupplierPaymentType()
    {
        Name = "SupplierPayment";

        Field("paymentId", x => x.PagamentoId);
        Field("invoiceId", x => x.FatturaId, nullable: true);
        Field("ddtId", x => x.DdtId, nullable: true);
        Field("paymentDate", x => x.DataPagamento, type: typeof(DateTimeGraphType));
        Field("amount", x => x.Importo);
        Field("paymentMethod", x => x.MetodoPagamento, nullable: true);
        Field("notes", x => x.Note, nullable: true);
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<PurchaseInvoiceType, FatturaAcquisto>("invoice")
            .Resolve(context => context.Source.Fattura);

        Field<DeliveryNoteType, DocumentoTrasporto>("ddt")
            .Resolve(context => context.Source.Ddt);

        Field<ListGraphType<MonthlyExpenseType>, IEnumerable<SpesaMensile>>("monthlyExpenses")
            .Resolve(context => context.Source.SpeseMensili);
    }
}
