using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Sales;

public class ProductType : ObjectGraphType<Product>
{
    public ProductType()
    {
        Field(x => x.ProductId);
        Field(x => x.Code);
        Field(x => x.Name);
        Field(x => x.Description, nullable: true);
        Field(x => x.Price);
        Field(x => x.Category, nullable: true);
        Field(x => x.UnitOfMeasure);
        Field(x => x.IsActive);
        Field(x => x.CreatedAt);
        Field(x => x.UpdatedAt);
    }
}
