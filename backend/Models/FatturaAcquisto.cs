using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("FattureAcquisto")]
    public class FatturaAcquisto
    {
        [Key]
        public int FatturaId { get; set; }

        [Required]
        public int FornitoreId { get; set; }

        [Required]
        [MaxLength(50)]
        public string NumeroFattura { get; set; } = string.Empty;

        [Required]
        public DateTime DataFattura { get; set; }

        public DateTime? DataScadenza { get; set; }

        [Required]
        [Column(TypeName = "decimal(10,2)")]
        public decimal Imponibile { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? ImportoIva { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? TotaleConIva { get; set; }

        [Required]
        [MaxLength(20)]
        public string Stato { get; set; } = "DA_PAGARE"; // DA_PAGARE, PARZIALMENTE_PAGATA, PAGATA

        public string? Note { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("FornitoreId")]
        public virtual Fornitore Fornitore { get; set; } = null!;

        public virtual ICollection<DocumentoTrasporto> DocumentiTrasporto { get; set; } = new List<DocumentoTrasporto>();
        public virtual ICollection<PagamentoFornitore> Pagamenti { get; set; } = new List<PagamentoFornitore>();
    }
}
