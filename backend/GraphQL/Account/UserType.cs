using System;

using GraphQL.Types;

using DueD.Models;

namespace DueD.GraphQL
{
    public class UserType : ObjectGraphType<User>
    {
        public UserType()
        {
            Description = "User";
            Field(x => x.UserId, type: typeof(IntGraphType), nullable: false).Description("userId");
            Field(x => x.UserName, type: typeof(StringGraphType), nullable: true).Description("userName");
            Field(x => x.FirstName, type: typeof(StringGraphType), nullable: true).Description("firstName");
            Field(x => x.LastName, type: typeof(StringGraphType), nullable: true).Description("lastName");
            Field(x => x.Description, type: typeof(StringGraphType), nullable: true).Description("description");
        }
    }
}
