using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("SpeseMensili")]
    public class SpesaMensile
    {
        [Key]
        public int SpesaId { get; set; }

        [Required]
        public int ChiusuraId { get; set; }

        public int? PagamentoId { get; set; }

        [Required]
        public string Descrizione { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Importo { get; set; }

        [MaxLength(50)]
        public string? Categoria { get; set; } // FORNITORE, AFFITTO, UTENZE, ALTRO

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("ChiusuraId")]
        public virtual ChiusuraMensile Chiusura { get; set; } = null!;

        [ForeignKey("PagamentoId")]
        public virtual PagamentoFornitore? Pagamento { get; set; }
    }
}
