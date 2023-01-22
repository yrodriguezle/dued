using GraphQL.Types;

using DueD.Models;
using DueD.Repositories;
using DueD.Services;

namespace DueD.GraphQL
{
    public class AccountQuieriesGroup : ObjectGraphType
    {
        public AccountQuieriesGroup(Defer<IRepository> repository, Defer<IAuthenticationService> authService)
        {
            Field<UserType, User>(Name = "currentUser")
                .ResolveAsync(async (context) =>
                {
                    string username = authService.Value.GetUserName();
                    return await repository.Value.User.GetByUsername(username);
                });
        }
    }
}
