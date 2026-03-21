namespace duedgusto.GraphQL.Subscriptions.Types;

public class VenditaCreatedEvent
{
    public int VenditaId { get; set; }
    public int RegistroCassaId { get; set; }
    public string NomeProdotto { get; set; } = string.Empty;
    public int Quantita { get; set; }
    public decimal PrezzoTotale { get; set; }
    public DateTime DataOra { get; set; }
}
