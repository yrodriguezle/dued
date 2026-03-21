namespace duedgusto.GraphQL.Subscriptions.Types;

public class RegistroCassaUpdatedEvent
{
    public int RegistroCassaId { get; set; }
    public DateTime Data { get; set; }
    public string Stato { get; set; } = string.Empty;
    public decimal TotaleVendite { get; set; }
    public decimal TotaleApertura { get; set; }
    public decimal TotaleChiusura { get; set; }
    public string Azione { get; set; } = string.Empty; // "CREATED", "UPDATED", "DELETED"
}
