using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("DocumentiTrasporto")]
    public class DocumentoTrasporto
    {
        [Key]
        public int DdtId { get; set; }

        public int? FatturaId { get; set; }

        [Required]
        public int FornitoreId { get; set; }

        [Required]
        [MaxLength(50)]
        public string NumeroDdt { get; set; } = string.Empty;

        [Required]
        public DateTime DataDdt { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? Importo { get; set; }

        public string? Note { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("FornitoreId")]
        public virtual Fornitore Fornitore { get; set; } = null!;

        [ForeignKey("FatturaId")]
        public virtual FatturaAcquisto? Fattura { get; set; }

        public virtual ICollection<PagamentoFornitore> Pagamenti { get; set; } = new List<PagamentoFornitore>();
    }
}
