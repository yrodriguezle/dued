using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("ChiusureMensili")]
    public class ChiusuraMensile
    {
        [Key]
        public int ChiusuraId { get; set; }

        [Required]
        public int Anno { get; set; }

        [Required]
        [Range(1, 12)]
        public int Mese { get; set; }

        [Required]
        public DateTime UltimoGiornoLavorativo { get; set; }

        // Riepilogo incassi (dalla lista cash register)
        [Column(TypeName = "decimal(10,2)")]
        public decimal? RicavoTotale { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? TotaleContanti { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? TotaleElettronici { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? TotaleFatture { get; set; }

        // Spese mensili aggiuntive
        [Column(TypeName = "decimal(10,2)")]
        public decimal? SpeseAggiuntive { get; set; }

        // Totali finali
        [Column(TypeName = "decimal(10,2)")]
        public decimal? RicavoNetto { get; set; }

        [Required]
        [MaxLength(20)]
        public string Stato { get; set; } = "BOZZA"; // BOZZA, CHIUSA, RICONCILIATA

        public string? Note { get; set; }

        public int? ChiusaDa { get; set; }

        public DateTime? ChiusaIl { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("ChiusaDa")]
        public virtual User? ChiusaDaUtente { get; set; }

        public virtual ICollection<SpesaMensile> Spese { get; set; } = [];
    }
}
