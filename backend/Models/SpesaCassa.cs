namespace duedgusto.Models;

public class SpesaCassa
{
    public int Id { get; set; }
    public int RegistroCassaId { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
}
