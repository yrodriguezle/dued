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

    /// <summary>
    /// Data (giorno di competenza) della spesa all'interno del mese della chiusura.
    /// Nullable per compatibilità con le spese storiche: la migration effettua il backfill
    /// al primo giorno del mese/anno della chiusura di appartenenza.
    /// </summary>
    [Column(TypeName = "date")]
    public DateTime? Data { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;
}
