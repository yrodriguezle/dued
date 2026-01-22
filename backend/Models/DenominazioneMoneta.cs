namespace duedgusto.Models;

public class DenominazioneMoneta
{
    public int Id { get; set; }
    public decimal Valore { get; set; }
    public string Tipo { get; set; } = string.Empty; // "COIN" or "BANKNOTE"
    public int OrdineVisualizzazione { get; set; }

    // Navigation property
    public ICollection<ConteggioMoneta> ConteggiMoneta { get; set; } = new List<ConteggioMoneta>();
}
