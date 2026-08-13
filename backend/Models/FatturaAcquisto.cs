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

        /// <summary>
        /// True (default): <see cref="ImportoIva"/> è stato CALCOLATO da un'aliquota.
        /// False: è l'importo LETTO dal documento e digitato dall'operatore — fattura
        /// multialiquota (Cash &amp; Carry: righe a 4/10/22% e un solo totale IVA stampato),
        /// dove nessuna aliquota unica esiste. Chi ricalcola gli importi della fattura
        /// (prelievo DDT) deve congelare l'IVA invece di riscorporarla.
        ///
        /// <para>Serve perché gli importi da soli non bastano: 22,00 su 100,00 è identico
        /// che sia calcolato o digitato. Lo storico precedente all'introduzione del campo
        /// è tutto calcolato, quindi il default true è corretto per retrocompatibilità.</para>
        /// </summary>
        [Required]
        public bool IvaCalcolata { get; set; } = true;

        [Required]
        [MaxLength(20)]
        public string Stato { get; set; } = "DA_PAGARE"; // DA_PAGARE, PARZIALMENTE_PAGATA, PAGATA

        public string? Note { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("FornitoreId")]
        public virtual Fornitore Fornitore { get; set; } = null!;

        public virtual ICollection<DocumentoTrasporto> DocumentiTrasporto { get; set; } = new List<DocumentoTrasporto>();
        public virtual ICollection<PagamentoFornitore> Pagamenti { get; set; } = new List<PagamentoFornitore>();
    }
}
