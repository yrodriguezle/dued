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
        [MaxLength(20)]
        public string Stato { get; set; } = "BOZZA"; // BOZZA, CHIUSA, RICONCILIATA

        public string? Note { get; set; }

        public int? ChiusaDa { get; set; }

        public DateTime? ChiusaIl { get; set; }

        public DateTime CreatoIl { get; set; } = DateTime.UtcNow;

        public DateTime AggiornatoIl { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// JSON: lista di giorni esclusi dalla validazione della chiusura mensile.
        /// Ogni elemento contiene data, motivo, note, timestamp esclusione e utente.
        /// </summary>
        public string? GiorniEsclusi { get; set; }

        // Navigation properties
        [ForeignKey("ChiusaDa")]
        public virtual Utente? ChiusaDaUtente { get; set; }

        // ✅ NAVIGATION PROPERTIES (Modello Referenziale Puro)
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

        /// <summary>
        /// Totale IVA calcolato dalla somma di ImportoIva dei registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal TotaleIvaCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.ImportoIva ?? 0);

        /// <summary>
        /// Totale imponibile calcolato (ricavo totale - IVA)
        /// </summary>
        [NotMapped]
        public decimal TotaleImponibileCalcolato => RicavoTotaleCalcolato - TotaleIvaCalcolato;

        /// <summary>
        /// Totale lordo calcolato (alias di ricavo totale, per chiarezza nei report)
        /// </summary>
        [NotMapped]
        public decimal TotaleLordoCalcolato => RicavoTotaleCalcolato;

        /// <summary>
        /// Totale differenze di cassa aggregate dai registri cassa inclusi
        /// </summary>
        [NotMapped]
        public decimal TotaleDifferenzeCassaCalcolato => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.Differenza ?? 0);
    }
}
