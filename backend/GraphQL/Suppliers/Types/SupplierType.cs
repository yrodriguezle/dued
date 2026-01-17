using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Suppliers.Types;

public class SupplierType : ObjectGraphType<Fornitore>
{
    public SupplierType()
    {
        Name = "Supplier";

        Field("supplierId", x => x.FornitoreId);
        Field("businessName", x => x.RagioneSociale);
        Field("vatNumber", x => x.PartitaIva, nullable: true);
        Field("fiscalCode", x => x.CodiceFiscale, nullable: true);
        Field("email", x => x.Email, nullable: true);
        Field("phone", x => x.Telefono, nullable: true);
        Field("address", x => x.Indirizzo, nullable: true);
        Field("city", x => x.Citta, nullable: true);
        Field("postalCode", x => x.Cap, nullable: true);
        Field("country", x => x.Paese);
        Field("notes", x => x.Note, nullable: true);
        Field("active", x => x.Attivo);
        Field("createdAt", x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        Field<ListGraphType<PurchaseInvoiceType>, IEnumerable<FatturaAcquisto>>("purchaseInvoices")
            .Resolve(context => context.Source.FattureAcquisto);

        Field<ListGraphType<DeliveryNoteType>, IEnumerable<DocumentoTrasporto>>("deliveryNotes")
            .Resolve(context => context.Source.DocumentiTrasporto);
    }
}
