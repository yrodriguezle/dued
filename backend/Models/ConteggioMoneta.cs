namespace duedgusto.Models;

public class ConteggioMoneta
{
    public int Id { get; set; }
    public int RegistroCassaId { get; set; }
    public int DenominazioneMonetaId { get; set; }
    public int Quantita { get; set; }
    public decimal Totale { get; set; }
    public bool IsApertura { get; set; } // true = apertura, false = chiusura

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public DenominazioneMoneta Denominazione { get; set; } = null!;
}
