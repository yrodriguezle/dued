using GraphQL.Types;

namespace duedgusto.GraphQL.Suppliers.Types;

public class SupplierPaymentInput
{
    public int? PaymentId { get; set; }
    public int? InvoiceId { get; set; }
    public int? DdtId { get; set; }
    public DateTime PaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? Notes { get; set; }
}

public class SupplierPaymentInputType : InputObjectGraphType<SupplierPaymentInput>
{
    public SupplierPaymentInputType()
    {
        Name = "SupplierPaymentInput";

        Field(x => x.PaymentId, nullable: true);
        Field(x => x.InvoiceId, nullable: true);
        Field(x => x.DdtId, nullable: true);
        Field(x => x.PaymentDate, type: typeof(DateGraphType));
        Field(x => x.Amount);
        Field(x => x.PaymentMethod, nullable: true);
        Field(x => x.Notes, nullable: true);
    }
}
