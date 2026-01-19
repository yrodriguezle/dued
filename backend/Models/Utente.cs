namespace duedgusto.Models;

public class Utente
{
    public int Id { get; set; }
    public string NomeUtente { get; set; } = string.Empty;
    public string? Nome { get; set; }
    public string? Cognome { get; set; }
    public string? Descrizione { get; set; }
    public bool? Disabilitato { get; set; }
    public string? TokenAggiornamento { get; set; } = string.Empty;
    public DateTime? ScadenzaTokenAggiornamento { get; set; }
    public required byte[] Hash { get; set; }
    public required byte[] Salt { get; set; }
    public int RuoloId { get; set; }
    public Ruolo Ruolo { get; set; } = null!;
}
