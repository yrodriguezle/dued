using System.Security.Claims;

using GraphQL;
using GraphQL.DataLoader;
using GraphQL.Types;

using DueD.Helpers;
using DueD.Models;
using DueD.Repositories;
using DueD.Services;

namespace DueD.GraphQL
{
    public class AccountMutationsGroup : ObjectGraphType
    {
        public AccountMutationsGroup(Defer<IRepository> repository, IEventMessageStack eventMessagesStack)
        {
            Field<UserType>(Name = "AddOrUpdateUser")
                .Argument<NonNullGraphType<UserInputType>>("user")
                .ResolveAsync(async context =>
                {
                    User userFromClient = context.GetArgument<User>("user");
                    User user = await repository.Value.User.AddOrUpdate(userFromClient);
                    eventMessagesStack.AddEventMessage(new EventMessage
                    {
                        Id = Guid.NewGuid().ToString(),
                        Entity = user,
                        SubscriptionName = "userChanged",
                    });
                    return user;
                });
        }
    }
}
