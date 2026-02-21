using GraphQL.Types;

namespace duedgusto.GraphQL.Suppliers.Types;

public class PurchaseInvoiceInput
{
    public int? InvoiceId { get; set; }
    public int SupplierId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public decimal TaxableAmount { get; set; }
    public decimal VatRate { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Notes { get; set; }
    public string Status { get; set; } = "DA_PAGARE";
}

public class PurchaseInvoiceInputType : InputObjectGraphType<PurchaseInvoiceInput>
{
    public PurchaseInvoiceInputType()
    {
        Name = "PurchaseInvoiceInput";

        Field(x => x.InvoiceId, nullable: true);
        Field(x => x.SupplierId);
        Field(x => x.InvoiceNumber);
        Field(x => x.InvoiceDate, type: typeof(DateGraphType));
        Field(x => x.TaxableAmount);
        Field(x => x.VatRate);
        Field(x => x.DueDate, nullable: true, type: typeof(DateGraphType));
        Field(x => x.Notes, nullable: true);
        Field(x => x.Status);
    }
}
