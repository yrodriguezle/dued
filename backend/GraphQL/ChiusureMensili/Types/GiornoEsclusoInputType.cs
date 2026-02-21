using GraphQL.Types;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

public class GiornoEsclusoInputType : InputObjectGraphType
{
    public GiornoEsclusoInputType()
    {
        Name = "GiornoEsclusoInput";
        Field<NonNullGraphType<DateGraphType>>("data");
        Field<NonNullGraphType<StringGraphType>>("codiceMotivo");
        Field<StringGraphType>("note");
    }
}
