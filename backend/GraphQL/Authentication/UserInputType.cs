using GraphQL.Types;

namespace duedgusto.GraphQL.Authentication;

public class UserInputType : InputObjectGraphType
{
    public UserInputType()
    {
        Name = "UserInput";
        Description = "Campi necessari per creare o aggiornare un utente";

        Field<IntGraphType>("userId");
        Field<NonNullGraphType<StringGraphType>>("userName");
        Field<NonNullGraphType<StringGraphType>>("firstName");
        Field<NonNullGraphType<StringGraphType>>("lastName");
        Field<StringGraphType>("description");
        Field<BooleanGraphType>("disabled");
        Field<NonNullGraphType<IntGraphType>>("roleId");
        Field<StringGraphType>("password");
    }
}
