using GraphQL.Types;

namespace duedgusto.GraphQL.Sales.Types;

public class UpdateSaleInput
{
    public int? ProductId { get; set; }
    public decimal? Quantity { get; set; }
    public string? Notes { get; set; }
}

public class UpdateSaleInputType : InputObjectGraphType<UpdateSaleInput>
{
    public UpdateSaleInputType()
    {
        Field(x => x.ProductId, nullable: true);
        Field(x => x.Quantity, nullable: true);
        Field(x => x.Notes, nullable: true);
    }
}
