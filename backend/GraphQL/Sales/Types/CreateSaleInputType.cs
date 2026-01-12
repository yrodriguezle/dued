using GraphQL.Types;

namespace duedgusto.GraphQL.Sales.Types;

public class CreateSaleInput
{
    public int RegisterId { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
    public DateTime? Timestamp { get; set; }
}

public class CreateSaleInputType : InputObjectGraphType<CreateSaleInput>
{
    public CreateSaleInputType()
    {
        Field(x => x.RegisterId);
        Field(x => x.ProductId);
        Field(x => x.Quantity);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Timestamp, nullable: true, type: typeof(DateTimeGraphType));
    }
}
