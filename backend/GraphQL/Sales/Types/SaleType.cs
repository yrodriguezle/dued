using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Sales.Types;

public class SaleType : ObjectGraphType<Sale>
{
    public SaleType(ProductType productType)
    {
        Field(x => x.SaleId);
        Field(x => x.RegisterId);
        Field(x => x.ProductId);
        Field(x => x.Quantity);
        Field(x => x.UnitPrice);
        Field(x => x.TotalPrice);
        Field(x => x.Notes, nullable: true);
        Field(x => x.Timestamp);
        Field(x => x.CreatedAt);
        Field(x => x.UpdatedAt);

        // Navigation property
        Field<ProductType>("product")
            .Resolve(context => context.Source.Product);
    }
}
