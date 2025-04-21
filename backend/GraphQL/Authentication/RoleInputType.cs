using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class RoleInputType : InputObjectGraphType<Role>
{
    public RoleInputType()
    {
        Name = "RoleInput";
        Description = "Campi necessari per creare o aggiornare un ruolo";

        Field<NonNullGraphType<IntGraphType>>(nameof(Role.RoleId));
        Field<NonNullGraphType<StringGraphType>>(nameof(Role.RoleName));
        Field<StringGraphType>(nameof(Role.RoleDescription));
    }
}
