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

        // ⚠️ CAMPI DENORMALIZZATI - OBSOLETI (mantenuti temporaneamente per migrazione)
        // TODO: Rimuovere dopo completamento migrazione e validazione
        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare RicavoTotaleCalcolato (proprietà calcolata)")]
        public decimal? RicavoTotale { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare TotaleContantiCalcolato (proprietà calcolata)")]
        public decimal? TotaleContanti { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare TotaleElettroniciCalcolato (proprietà calcolata)")]
        public decimal? TotaleElettronici { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare TotaleFattureCalcolato (proprietà calcolata)")]
        public decimal? TotaleFatture { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare SpeseAggiuntiveCalcolate (proprietà calcolata)")]
        public decimal? SpeseAggiuntive { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        [Obsolete("Usare RicavoNettoCalcolato (proprietà calcolata)")]
        public decimal? RicavoNetto { get; set; }

        [Required]
        [MaxLength(20)]
        public string Stato { get; set; } = "BOZZA"; // BOZZA, CHIUSA, RICONCILIATA

        public string? Note { get; set; }

        public int? ChiusaDa { get; set; }

        public DateTime? ChiusaIl { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        // Navigation properties (vecchie - mantenute per compatibilità)
        [ForeignKey("ChiusaDa")]
        public virtual Utente? ChiusaDaUtente { get; set; }

        [Obsolete("Usare SpeseLibere e PagamentiInclusi separati")]
        public virtual ICollection<SpesaMensile> Spese { get; set; } = [];

        // ✅ NUOVE NAVIGATION PROPERTIES (Modello Referenziale Puro)
        /// <summary>
        /// Registri cassa giornalieri inclusi in questa chiusura mensile
        /// </summary>
        public virtual ICollection<RegistroCassaMensile> RegistriInclusi { get; set; } = [];

        /// <summary>
        /// Spese mensili libere (affitto, utenze, stipendi, altro)
        /// </summary>
        public virtual ICollection<SpesaMensileLibera> SpeseLibere { get; set; } = [];

        /// <summary>
        /// Pagamenti fornitori inclusi in questa chiusura mensile
        /// </summary>
        public virtual ICollection<PagamentoMensileFornitori> PagamentiInclusi { get; set; } = [];

        // ✅ PROPRIETÀ CALCOLATE (NotMapped - calcolate a runtime)
        /// <summary>
        /// Ricavo totale calcolato dalla somma di tutti i registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal RicavoTotaleCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.TotaleVendite ?? 0);

        /// <summary>
        /// Totale contanti calcolato dalla somma di tutti i registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal TotaleContantiCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.IncassoContanteTracciato ?? 0);

        /// <summary>
        /// Totale pagamenti elettronici calcolato dalla somma di tutti i registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal TotaleElettroniciCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.IncassiElettronici ?? 0);

        /// <summary>
        /// Totale fatture calcolato dalla somma di tutti i registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal TotaleFattureCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.IncassiFattura ?? 0);

        /// <summary>
        /// Spese aggiuntive calcolate dalla somma di spese libere + pagamenti fornitori inclusi
        /// </summary>
        [NotMapped]
        public decimal SpeseAggiuntiveCalcolate =>
            SpeseLibere.Sum(s => s.Importo) +
            PagamentiInclusi.Where(p => p.InclusoInChiusura).Sum(p => p.Pagamento?.Importo ?? 0);

        /// <summary>
        /// Ricavo netto calcolato (ricavo totale - spese aggiuntive)
        /// </summary>
        [NotMapped]
        public decimal RicavoNettoCalcolato => RicavoTotaleCalcolato - SpeseAggiuntiveCalcolate;
    }
}
