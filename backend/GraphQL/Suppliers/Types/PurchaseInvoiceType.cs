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
        Field<DateTimeGraphType>("invoiceDate").Resolve(x => x.Source.DataFattura);
        Field("taxableAmount", x => x.Imponibile);
        Field("vatAmount", x => x.ImportoIva, nullable: true);
        Field("totalAmount", x => x.TotaleConIva, nullable: true);
        Field("status", x => x.Stato);
        Field<DateTimeGraphType>("dueDate").Resolve(x => x.Source.DataScadenza);
        Field("notes", x => x.Note, nullable: true);
        Field<DateTimeGraphType>("createdAt").Resolve(x => x.Source.CreatoIl);
        Field<DateTimeGraphType>("updatedAt").Resolve(x => x.Source.AggiornatoIl);

        Field<SupplierType, Fornitore>("supplier")
            .Resolve(context => context.Source.Fornitore);

        Field<ListGraphType<DeliveryNoteType>, IEnumerable<DocumentoTrasporto>>("deliveryNotes")
            .Resolve(context => context.Source.DocumentiTrasporto);

        Field<ListGraphType<SupplierPaymentType>, IEnumerable<PagamentoFornitore>>("payments")
            .Resolve(context => context.Source.Pagamenti);
    }
}
