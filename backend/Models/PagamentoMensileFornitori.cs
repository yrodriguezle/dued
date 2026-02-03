using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

/// <summary>
/// Join table che associa i pagamenti fornitori a una chiusura mensile.
/// Separa la semantica dei pagamenti fatture dalle spese libere.
/// L'importo viene preso da PagamentoFornitore.Importo (Single Source of Truth).
/// </summary>
[Table("PagamentiMensiliFornitori")]
public class PagamentoMensileFornitori
{
    /// <summary>
    /// ID della chiusura mensile
    /// </summary>
    public int ChiusuraId { get; set; }

    /// <summary>
    /// ID del pagamento fornitore
    /// </summary>
    public int PagamentoId { get; set; }

    /// <summary>
    /// Flag che indica se il pagamento è incluso nel calcolo delle spese totali.
    /// Permette esclusioni temporanee senza eliminare il link.
    /// </summary>
    public bool InclusoInChiusura { get; set; } = true;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;

    [ForeignKey("PagamentoId")]
    public PagamentoFornitore Pagamento { get; set; } = null!;
}
