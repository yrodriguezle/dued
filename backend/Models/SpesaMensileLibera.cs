using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

/// <summary>
/// Rappresenta una spesa mensile "libera", non legata a fatture fornitori.
/// Include affitto, utenze, stipendi e altre spese varie.
/// </summary>
[Table("SpeseMensiliLibere")]
public class SpesaMensileLibera
{
    [Key]
    public int SpesaId { get; set; }

    [Required]
    public int ChiusuraId { get; set; }

    [Required]
    public string Descrizione { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "decimal(10,2)")]
    public decimal Importo { get; set; }

    /// <summary>
    /// Categoria type-safe della spesa (enum)
    /// </summary>
    [Required]
    public CategoriaSpesa Categoria { get; set; }

    public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

    public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;
}
