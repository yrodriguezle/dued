using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Suppliers.Types;

public class DeliveryNoteType : ObjectGraphType<DocumentoTrasporto>
{
    public DeliveryNoteType()
    {
        Name = "DeliveryNote";

        Field("ddtId", x => x.DdtId);
        Field("invoiceId", x => x.FatturaId, nullable: true);
        Field("supplierId", x => x.FornitoreId);
        Field("ddtNumber", x => x.NumeroDdt);
        Field("ddtDate", x => x.DataDdt, type: typeof(DateTimeGraphType));
        Field("amount", x => x.Importo, nullable: true);
        Field("notes", x => x.Note, nullable: true);
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<SupplierType, Fornitore>("supplier")
            .Resolve(context => context.Source.Fornitore);

        Field<PurchaseInvoiceType, FatturaAcquisto>("invoice")
            .Resolve(context => context.Source.Fattura);

        Field<ListGraphType<SupplierPaymentType>, IEnumerable<PagamentoFornitore>>("payments")
            .Resolve(context => context.Source.Pagamenti);
    }
}
