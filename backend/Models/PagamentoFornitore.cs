using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("PagamentiFornitori")]
    public class PagamentoFornitore
    {
        [Key]
        public int PagamentoId { get; set; }

        public int? FatturaId { get; set; }

        public int? DdtId { get; set; }

        [Required]
        public DateTime DataPagamento { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Importo { get; set; }

        [MaxLength(50)]
        public string? MetodoPagamento { get; set; }

        public string? Note { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("FatturaId")]
        public virtual FatturaAcquisto? Fattura { get; set; }

        [ForeignKey("DdtId")]
        public virtual DocumentoTrasporto? Ddt { get; set; }

        public int? RegistroCassaId { get; set; }
        [ForeignKey("RegistroCassaId")]
        public virtual RegistroCassa? RegistroCassa { get; set; }

        public virtual ICollection<SpesaMensile> SpeseMensili { get; set; } = new List<SpesaMensile>();
    }
}
