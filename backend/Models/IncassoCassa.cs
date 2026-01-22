namespace duedgusto.Models;

public class IncassoCassa
{
    public int Id { get; set; }
    public int RegistroCassaId { get; set; }
    public string Tipo { get; set; } = string.Empty; // "Pago in Bianco (Contante)", "Pagamenti Elettronici", "Pagamento con Fattura"
    public decimal Importo { get; set; }

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
}
