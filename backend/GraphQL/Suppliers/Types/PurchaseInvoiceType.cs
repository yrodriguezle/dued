using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Suppliers.Types;

public class PurchaseInvoiceType : ObjectGraphType<FatturaAcquisto>
{
    public PurchaseInvoiceType()
    {
        Name = "PurchaseInvoice";

        Field("invoiceId", x => x.FatturaId);
        Field("supplierId", x => x.FornitoreId);
        Field("invoiceNumber", x => x.NumeroFattura);
        Field("invoiceDate", x => x.DataFattura, type: typeof(DateTimeGraphType));
        Field("taxableAmount", x => x.Imponibile);
        Field("vatAmount", x => x.ImportoIva, nullable: true);
        Field("totalAmount", x => x.TotaleConIva, nullable: true);
        Field("status", x => x.Stato);
        Field("dueDate", x => x.DataScadenza, nullable: true, type: typeof(DateTimeGraphType));
        Field("notes", x => x.Note, nullable: true);
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<SupplierType, Fornitore>("supplier")
            .Resolve(context => context.Source.Fornitore);

        Field<ListGraphType<DeliveryNoteType>, IEnumerable<DocumentoTrasporto>>("deliveryNotes")
            .Resolve(context => context.Source.DocumentiTrasporto);

        Field<ListGraphType<SupplierPaymentType>, IEnumerable<PagamentoFornitore>>("payments")
            .Resolve(context => context.Source.Pagamenti);
    }
}
