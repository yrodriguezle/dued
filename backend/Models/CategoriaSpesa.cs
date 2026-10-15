namespace duedgusto.Models;

/// <summary>
/// Categoria di spesa configurabile dall'utente (affitto, utenze, stipendi, beni,
/// macchinari…). Sostituisce l'enum fisso omonimo: il nome resta l'identità logica
/// consumata dal frontend (tendina a stringhe), mentre <see cref="Id"/> è la chiave
/// esterna usata da <see cref="SpesaCassa"/> e <see cref="PagamentoFornitore"/>.
/// </summary>
public class CategoriaSpesa
{
    public int Id { get; set; }

    /// <summary>Nome univoco e stabile (es. "Affitto", "Beni", "Macchinari").</summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>Se false, la categoria non compare più nelle tendine ma resta per lo storico.</summary>
    public bool Attiva { get; set; } = true;

    /// <summary>Ordine di visualizzazione crescente nelle tendine.</summary>
    public int Ordine { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SpesaCassa> Spese { get; set; } = [];
    public ICollection<PagamentoFornitore> Pagamenti { get; set; } = [];
}
