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

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

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
        /// Somma delle spese giornaliere dei registri cassa inclusi nella chiusura
        /// </summary>
        [NotMapped]
        public decimal SpeseGiornaliereRegistriCalcolate => RegistriInclusi
            .Where(r => r.Incluso)
            .Sum(r => r.Registro?.SpeseGiornaliere ?? 0);

        /// <summary>
        /// Ricavo netto calcolato (ricavo totale - spese aggiuntive - spese giornaliere dei registri inclusi)
        /// </summary>
        [NotMapped]
        public decimal RicavoNettoCalcolato =>
            RicavoTotaleCalcolato - SpeseAggiuntiveCalcolate - SpeseGiornaliereRegistriCalcolate;

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

        // ✅ PROPRIETÀ CALCOLATE GESTIONALI ANTI-DOPPIO-CONTEGGIO (headline vista chiusura)
        // Single source of truth backend per KPI/headline gestionali. NON toccano i campi
        // fiscali *Calcolato esistenti (report fiscale invariato).

        /// <summary>
        /// Spese aggiuntive NON duplicate rispetto ai registri cassa inclusi (headline gestionale).
        /// = Σ SpeseLibere.Importo
        ///   + Σ Pagamenti fornitori inclusi il cui PagamentoFornitore NON è già conteggiato in un
        ///     registro incluso (RegistroCassaId == null OPPURE RegistroCassaId non appartiene ai
        ///     registri realmente inclusi della chiusura).
        /// Motivazione contabile: RegistroCassa.SpeseFornitori viene ricalcolato sommando i
        /// PagamentoFornitore linkati al registro (RegistroCassaSyncService.RecalculateSpeseFornitoriAsync);
        /// i pagamenti appartenenti a un registro incluso sono quindi GIÀ presenti nel totale spese di
        /// quel registro e vanno esclusi qui per evitare il doppio conteggio. Il criterio corretto è
        /// l'APPARTENENZA ai registri inclusi, NON il solo RegistroCassaId == null.
        /// </summary>
        [NotMapped]
        public decimal SpeseAggiuntiveNonDuplicateCalcolate
        {
            get
            {
                HashSet<int> registriIdInclusi = RegistriInclusi
                    .Where(r => r.Incluso)
                    .Select(r => r.RegistroId)
                    .ToHashSet();

                decimal pagamentiNonDuplicati = PagamentiInclusi
                    .Where(p => p.InclusoInChiusura && p.Pagamento != null)
                    .Where(p => p.Pagamento!.RegistroCassaId == null
                        || !registriIdInclusi.Contains(p.Pagamento.RegistroCassaId.Value))
                    .Sum(p => p.Pagamento!.Importo);

                return SpeseLibere.Sum(s => s.Importo) + pagamentiNonDuplicati;
            }
        }

        /// <summary>
        /// Totale spese gestionale (headline della vista chiusura).
        /// = spese dei registri inclusi [tracciate (SpeseFornitori) + non tracciate (SpeseGiornaliere),
        ///   coerenti con RiepilogoAnnualeCassa/aggregaRegistri: SpeseTracciate = Σ SpeseFornitori,
        ///   SpeseNonTracciate = Σ SpeseGiornaliere]
        /// + SpeseAggiuntiveNonDuplicateCalcolate (spese libere + pagamenti fornitori non già nei registri).
        /// </summary>
        [NotMapped]
        public decimal TotaleSpeseCalcolato =>
            RegistriInclusi
                .Where(r => r.Incluso)
                .Sum(r => (r.Registro?.SpeseFornitori ?? 0) + (r.Registro?.SpeseGiornaliere ?? 0))
            + SpeseAggiuntiveNonDuplicateCalcolate;

        /// <summary>
        /// Differenza gestionale = totale vendite dei registri inclusi (RicavoTotaleCalcolato)
        /// - TotaleSpeseCalcolato. Riusa RicavoTotaleCalcolato per coerenza al centesimo con i registri.
        /// </summary>
        [NotMapped]
        public decimal DifferenzaCalcolata => RicavoTotaleCalcolato - TotaleSpeseCalcolato;

        /// <summary>
        /// Avvisi (WARNING) di completezza NON bloccanti rilevati alla chiusura mensile:
        /// registri chiusi/riconciliati del mese non inclusi, pagamenti fornitori del mese non inclusi.
        /// Popolato a runtime dal service (NON persistito): campo di sola presentazione.
        /// </summary>
        [NotMapped]
        public List<string> AvvisiCompletezza { get; set; } = [];
    }
}
