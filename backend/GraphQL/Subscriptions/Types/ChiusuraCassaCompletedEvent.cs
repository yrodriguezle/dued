namespace duedgusto.GraphQL.Subscriptions.Types;

public class ChiusuraCassaCompletedEvent
{
    public int RegistroCassaId { get; set; }
    public DateTime Data { get; set; }
    public decimal TotaleChiusura { get; set; }
    public decimal Differenza { get; set; }
}
