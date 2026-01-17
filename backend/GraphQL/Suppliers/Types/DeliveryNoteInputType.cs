using GraphQL.Types;

namespace duedgusto.GraphQL.Suppliers.Types;

public class DeliveryNoteInput
{
    public int? DdtId { get; set; }
    public int? InvoiceId { get; set; }
    public int SupplierId { get; set; }
    public string DdtNumber { get; set; } = string.Empty;
    public DateTime DdtDate { get; set; }
    public decimal? Amount { get; set; }
    public string? Notes { get; set; }
}

public class DeliveryNoteInputType : InputObjectGraphType<DeliveryNoteInput>
{
    public DeliveryNoteInputType()
    {
        Name = "DeliveryNoteInput";

        Field(x => x.DdtId, nullable: true);
        Field(x => x.InvoiceId, nullable: true);
        Field(x => x.SupplierId);
        Field(x => x.DdtNumber);
        Field(x => x.DdtDate, type: typeof(DateTimeGraphType));
        Field(x => x.Amount, nullable: true);
        Field(x => x.Notes, nullable: true);
    }
}
