using GraphQL.Types;

namespace duedgusto.GraphQL.Subscriptions.Types;

public class SettingsUpdatedEventType : ObjectGraphType<SettingsUpdatedEvent>
{
    public SettingsUpdatedEventType()
    {
        Name = "SettingsUpdatedEvent";
        Field("azione", x => x.Azione);
        Field("timestamp", x => x.Timestamp, type: typeof(DateTimeGraphType));
    }
}
