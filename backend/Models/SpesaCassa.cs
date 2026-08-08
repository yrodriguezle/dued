namespace duedgusto.Models;

public class SpesaCassa
{
    public int Id { get; set; }
    public int RegistroCassaId { get; set; }
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }

    /// <summary>
    /// Categoria della spesa (NON tracciata / contanti). NOT NULL, default <see cref="CategoriaSpesa.Altro"/>.
    /// </summary>
    public CategoriaSpesa Categoria { get; set; } = CategoriaSpesa.Altro;

    /// <summary>
    /// Annotazione libera sulla riga, distinta dalla <see cref="Descrizione"/>.
    /// Simmetrica a <see cref="PagamentoFornitore.Note"/>: la griglia delle spese
    /// della chiusura mensile scrive su entrambe a seconda del metodo di pagamento.
    /// </summary>
    public string? Note { get; set; }

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
}
