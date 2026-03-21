using GraphQL;
using GraphQL.Resolvers;
using GraphQL.Types;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.Services.Events;

namespace duedgusto.GraphQL.Subscriptions;

public class GraphQLSubscriptions : ObjectGraphType
{
    public GraphQLSubscriptions(IEventBus eventBus)
    {
        this.Authorize();

        AddField(new FieldType
        {
            Name = "onRegistroCassaUpdated",
            Type = typeof(RegistroCassaUpdatedEventType),
            StreamResolver = new SourceStreamResolver<RegistroCassaUpdatedEvent>(
                _ => eventBus.Subscribe<RegistroCassaUpdatedEvent>()
            ),
            Resolver = new FuncFieldResolver<RegistroCassaUpdatedEvent>(
                context => context.Source as RegistroCassaUpdatedEvent
            )
        });

        AddField(new FieldType
        {
            Name = "onVenditaCreated",
            Type = typeof(VenditaCreatedEventType),
            StreamResolver = new SourceStreamResolver<VenditaCreatedEvent>(
                _ => eventBus.Subscribe<VenditaCreatedEvent>()
            ),
            Resolver = new FuncFieldResolver<VenditaCreatedEvent>(
                context => context.Source as VenditaCreatedEvent
            )
        });

        AddField(new FieldType
        {
            Name = "onChiusuraCassaCompleted",
            Type = typeof(ChiusuraCassaCompletedEventType),
            StreamResolver = new SourceStreamResolver<ChiusuraCassaCompletedEvent>(
                _ => eventBus.Subscribe<ChiusuraCassaCompletedEvent>()
            ),
            Resolver = new FuncFieldResolver<ChiusuraCassaCompletedEvent>(
                context => context.Source as ChiusuraCassaCompletedEvent
            )
        });

        AddField(new FieldType
        {
            Name = "onSettingsUpdated",
            Type = typeof(SettingsUpdatedEventType),
            StreamResolver = new SourceStreamResolver<SettingsUpdatedEvent>(
                _ => eventBus.Subscribe<SettingsUpdatedEvent>()
            ),
            Resolver = new FuncFieldResolver<SettingsUpdatedEvent>(
                context => context.Source as SettingsUpdatedEvent
            )
        });
    }
}
