using Microsoft.EntityFrameworkCore;

using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Aggregato mensile dei registri cassa per la dashboard annuale.
/// Formule normative identiche alla vista mensile (DRAFT inclusi nei totali).
/// </summary>
public class RiepilogoMeseCassa
{
    public int Anno { get; set; }
    public int Mese { get; set; } // 1-12
    public decimal TotaleVendite { get; set; }
    /// <summary>Σ IncassoContanteTracciato + IncassiElettronici + IncassiFattura</summary>
    public decimal RicavoTracciato { get; set; }
    /// <summary>Σ (TotaleChiusura − TotaleApertura) − IncassoContanteTracciato</summary>
    public decimal RicavoNonTracciato { get; set; }
    /// <summary>Σ SpeseFornitori</summary>
    public decimal SpeseTracciate { get; set; }
    /// <summary>Σ SpeseGiornaliere</summary>
    public decimal SpeseNonTracciate { get; set; }
    public decimal IncassoContanteTracciato { get; set; }
    public decimal IncassiElettronici { get; set; }
    public decimal IncassiFattura { get; set; }
    public int Registri { get; set; }
    /// <summary>Registri in stato CLOSED o RECONCILED.</summary>
    public int Chiusi { get; set; }
    /// <summary>Registri in stato DRAFT (inclusi comunque nei totali monetari).</summary>
    public int Bozze { get; set; }
}

/// <summary>
/// Riepilogo annuale per la dashboard: esattamente 12 mesi (1-12), mesi vuoti a zero.
/// </summary>
public class RiepilogoAnnualeCassa
{
    public int Anno { get; set; }
    public List<RiepilogoMeseCassa> Mesi { get; set; } = [];

    /// <summary>
    /// Aggregazione mensile lato SQL (GroupBy + Sum/Count traducibili) sui registri
    /// dell'anno richiesto, senza filtro sullo stato (le bozze concorrono ai totali,
    /// come nella vista mensile). Completa sempre a 12 mesi ordinati 1-12.
    /// </summary>
    public static async Task<RiepilogoAnnualeCassa> AggregaAsync(IQueryable<RegistroCassa> registri, int anno)
    {
        List<RiepilogoMeseCassa> aggregati = await registri
            .Where(r => r.Data.Year == anno)
            .GroupBy(r => r.Data.Month)
            .Select(g => new RiepilogoMeseCassa
            {
                Anno = anno,
                Mese = g.Key,
                TotaleVendite = g.Sum(r => r.TotaleVendite),
                RicavoTracciato = g.Sum(r => r.IncassoContanteTracciato + r.IncassiElettronici + r.IncassiFattura),
                RicavoNonTracciato = g.Sum(r => (r.TotaleChiusura - r.TotaleApertura) - r.IncassoContanteTracciato),
                SpeseTracciate = g.Sum(r => r.SpeseFornitori),
                SpeseNonTracciate = g.Sum(r => r.SpeseGiornaliere),
                IncassoContanteTracciato = g.Sum(r => r.IncassoContanteTracciato),
                IncassiElettronici = g.Sum(r => r.IncassiElettronici),
                IncassiFattura = g.Sum(r => r.IncassiFattura),
                Registri = g.Count(),
                Chiusi = g.Count(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED"),
                Bozze = g.Count(r => r.Stato == "DRAFT"),
            })
            .ToListAsync();

        return CompletaDodiciMesi(anno, aggregati);
    }

    /// <summary>
    /// Garantisce esattamente 12 elementi ordinati per mese 1-12: i mesi assenti
    /// negli aggregati vengono riempiti con valori a zero.
    /// </summary>
    public static RiepilogoAnnualeCassa CompletaDodiciMesi(int anno, IEnumerable<RiepilogoMeseCassa> aggregati)
    {
        Dictionary<int, RiepilogoMeseCassa> perMese = aggregati
            .Where(m => m.Mese >= 1 && m.Mese <= 12)
            .ToDictionary(m => m.Mese);

        List<RiepilogoMeseCassa> mesi = Enumerable.Range(1, 12)
            .Select(mese => perMese.TryGetValue(mese, out RiepilogoMeseCassa? aggregato)
                ? aggregato
                : new RiepilogoMeseCassa { Anno = anno, Mese = mese })
            .ToList();

        return new RiepilogoAnnualeCassa { Anno = anno, Mesi = mesi };
    }
}
