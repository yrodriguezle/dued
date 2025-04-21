using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class UserInputType : InputObjectGraphType<User>
{
    public UserInputType()
    {
        Name = "UserInput";
        Description = "Campi necessari per creare o aggiornare un utente";

        Field<NonNullGraphType<StringGraphType>>(nameof(User.UserName));
        Field<NonNullGraphType<StringGraphType>>(nameof(User.FirstName));
        Field<NonNullGraphType<StringGraphType>>(nameof(User.LastName));
        Field<StringGraphType>(nameof(User.Description));
        Field<BooleanGraphType>(nameof(User.Disabled));
        Field<NonNullGraphType<IntGraphType>>(nameof(User.RoleId));
    }
}
