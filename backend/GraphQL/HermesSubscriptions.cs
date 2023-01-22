using GraphQL;
using GraphQL.Resolvers;
using GraphQL.Types;

using DueD.Helpers;
using DueD.Models;

namespace DueD.GraphQL
{
    public class DueDSubscriptions : ObjectGraphType
    {
        private IEventMessageStack _eventMessagesStack;

        private static T? EntityFromEventMessage<T>(IResolveFieldContext context, string subscriptionName)
        {
            return context.Source is not null
                && ((EventMessage)context.Source).Entity is T entity
                && ((EventMessage)context.Source).SubscriptionName == subscriptionName
                ? entity
                : default;
        }
        private void AddFieldEntity<TType, IEntity>(string operationType)
        {
            AddField(new FieldType
            {
                Name = operationType,
                Arguments = new QueryArguments(
                    new QueryArgument<IntGraphType> { Name = "userId" }
                ),
                Type = typeof(TType),
                Resolver = new FuncFieldResolver<IEntity>(
                    context =>
                    {
                        int subscriberUserId = context.GetArgument<int>("userId");
                        int mutationUserId = context.Source is not null ? ((EventMessage)context.Source).UserId : 0;

                        bool shouldCheckUser = subscriberUserId > 0 && mutationUserId > 0;
                        
                        if (!shouldCheckUser || mutationUserId != subscriberUserId)
                        {
                            return EntityFromEventMessage<IEntity>(context, operationType);
                        }
                        return default;
                    }),
                StreamResolver = new SourceStreamResolver<EventMessage>(context =>
                {
                    return _eventMessagesStack.GetEventMessageSubject();
                })
            });
        }

        public DueDSubscriptions(IEventMessageStack eventMessagesStack)
        {
            _eventMessagesStack = eventMessagesStack;

            // User
            AddFieldEntity<UserType, User>("userChanged");
            AddFieldEntity<UserType, User>("userDeleted");
        }
    }
}
