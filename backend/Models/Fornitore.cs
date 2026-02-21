using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models
{
    [Table("Fornitori")]
    public class Fornitore
    {
        [Key]
        public int FornitoreId { get; set; }

        [Required]
        [MaxLength(255)]
        public string RagioneSociale { get; set; } = string.Empty;

        [MaxLength(20)]
        public string? PartitaIva { get; set; }

        [MaxLength(16)]
        public string? CodiceFiscale { get; set; }

        public string? Indirizzo { get; set; }

        [MaxLength(100)]
        public string? Citta { get; set; }

        [MaxLength(10)]
        public string? Cap { get; set; }

        [MaxLength(2)]
        public string? Provincia { get; set; }

        [MaxLength(2)]
        public string Paese { get; set; } = "IT";

        [MaxLength(255)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? Telefono { get; set; }

        public string? Note { get; set; }

        public bool Attivo { get; set; } = true;

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public virtual ICollection<FatturaAcquisto> FattureAcquisto { get; set; } = new List<FatturaAcquisto>();
        public virtual ICollection<DocumentoTrasporto> DocumentiTrasporto { get; set; } = new List<DocumentoTrasporto>();
    }
}
