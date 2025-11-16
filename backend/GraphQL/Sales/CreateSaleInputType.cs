using GraphQL.Types;

namespace duedgusto.GraphQL.Sales;

public class CreateSaleInputType : InputObjectGraphType
{
    public CreateSaleInputType()
    {
        Field<NonNullGraphType<IntGraphType>>("registerId");
        Field<NonNullGraphType<IntGraphType>>("productId");
        Field<NonNullGraphType<DecimalGraphType>>("quantity");
        Field<StringGraphType>("notes");
        Field<DateTimeGraphType>("timestamp");
    }
}
