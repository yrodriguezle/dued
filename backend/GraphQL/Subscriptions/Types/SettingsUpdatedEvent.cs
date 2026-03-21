namespace duedgusto.GraphQL.Subscriptions.Types;

public class SettingsUpdatedEvent
{
    public string Azione { get; set; } = string.Empty; // "CREATO", "AGGIORNATO", "ELIMINATO"
    public DateTime Timestamp { get; set; }
}
