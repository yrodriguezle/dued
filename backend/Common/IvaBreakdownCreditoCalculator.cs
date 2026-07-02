using duedgusto.Models;

namespace duedgusto.Common;

/// <summary>
/// Riga del breakdown IVA a CREDITO (acquisti) — dato GESTIONALE DI CASSA, non fiscale.
/// Aliquota in PERCENTUALE (es. 22.00). <c>Fonte</c> = "FATTURA" | "DDT".
/// <c>Stimato = true</c> quando l'IVA non è un dato certo da fattura:
/// DDT non ancora fatturato (nessun diritto di detrazione, aliquota fornitore presuntiva)
/// oppure fattura priva di ImportoIva persistito (fallback su aliquota fornitore).
/// <c>AliquotaMista = true</c> quando l'aliquota implicita della fattura
/// (ImportoIva/Imponibile) non è un'aliquota di legge → fattura multi-aliquota,
/// il valore mostrato è una media ponderata, non un'aliquota reale.
/// </summary>
public class RigaBreakdownIvaCredito
{
    public int RegistroCassaId { get; set; }
    public decimal Aliquota { get; set; }
    public decimal Imponibile { get; set; }
    public decimal Imposta { get; set; }
    public string Fonte { get; set; } = FonteFattura;
    public bool Stimato { get; set; }
    public bool AliquotaMista { get; set; }

    public const string FonteFattura = "FATTURA";
    public const string FonteDdt = "DDT";
}

/// <summary>
/// Calculator PURO dell'IVA a credito (acquisti) di un registro cassa a partire dai
/// pagamenti fornitori del giorno. Calcolo AL VOLO, nessuna persistenza.
///
/// <para><b>Natura del dato</b>: scorporo PER CASSA dell'importo effettivamente pagato
/// oggi — NON è l'IVA detraibile fiscale (che si computa per competenza sulla fattura
/// registrata, indipendentemente dal pagamento). Va sempre etichettato come indicativo.</para>
///
/// <para><b>Aliquota per pagamento</b>:
/// <list type="bullet">
/// <item>FATTURA con ImportoIva persistito → aliquota implicita = ImportoIva/Imponibile
///   (Stimato=false); se non è un'aliquota di legge → AliquotaMista=true (fattura
///   multi-aliquota, media ponderata).</item>
/// <item>FATTURA senza ImportoIva → fallback su Fornitore.AliquotaIva (Stimato=true).</item>
/// <item>DDT → Fornitore.AliquotaIva presuntiva (Stimato=true: nessuna fattura, nessun
///   diritto certo di detrazione).</item>
/// </list>
/// Lo scorporo è per pagamento (Σ scorpori, mai scorporo della somma) via
/// <see cref="IvaCalculator.ScorporaDaLordo"/>; le righe sono raggruppate per
/// (Fonte, Aliquota, Stimato, AliquotaMista) e ordinate FATTURA prima, aliquota decrescente.
/// I pagamenti privi sia di fattura sia di DDT sono ignorati (nessuna aliquota derivabile).</para>
/// </summary>
public static class IvaBreakdownCreditoCalculator
{
    private const decimal AliquotaFallbackPercent = 22m;

    /// <param name="pagamenti">Pagamenti fornitori del registro con navigation Fattura,
    /// Ddt e i rispettivi Fornitore già caricati dal chiamante (DataLoader).</param>
    public static IReadOnlyList<RigaBreakdownIvaCredito> Calcola(
        IReadOnlyCollection<PagamentoFornitore> pagamenti)
    {
        List<RigaBreakdownIvaCredito> righeDettaglio = new();

        foreach (PagamentoFornitore p in pagamenti)
        {
            (decimal aliquotaPercent, string fonte, bool stimato, bool mista)? classificazione =
                Classifica(p);
            if (classificazione is null)
            {
                continue; // né fattura né DDT: nessuna aliquota derivabile
            }

            (decimal aliquotaPercent, string fonte, bool stimato, bool mista) c = classificazione.Value;
            RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
                p.Importo, IvaCalculator.AliquotaDaPercentuale(c.aliquotaPercent));

            righeDettaglio.Add(new RigaBreakdownIvaCredito
            {
                Aliquota = c.aliquotaPercent,
                Imponibile = scorporo.Imponibile,
                Imposta = scorporo.Iva,
                Fonte = c.fonte,
                Stimato = c.stimato,
                AliquotaMista = c.mista,
            });
        }

        return righeDettaglio
            .GroupBy(r => new { r.Fonte, r.Aliquota, r.Stimato, r.AliquotaMista })
            .Select(g => new RigaBreakdownIvaCredito
            {
                Fonte = g.Key.Fonte,
                Aliquota = g.Key.Aliquota,
                Stimato = g.Key.Stimato,
                AliquotaMista = g.Key.AliquotaMista,
                Imponibile = g.Sum(r => r.Imponibile),
                Imposta = g.Sum(r => r.Imposta),
            })
            .Where(r => r.Imponibile != 0 || r.Imposta != 0)
            // FATTURA (dato certo) prima di DDT (stima), poi aliquota decrescente
            .OrderBy(r => r.Fonte == RigaBreakdownIvaCredito.FonteFattura ? 0 : 1)
            .ThenByDescending(r => r.Aliquota)
            .ToList();
    }

    /// <summary>Deriva (aliquota %, fonte, stimato, mista) da un pagamento; null se non classificabile.</summary>
    private static (decimal aliquotaPercent, string fonte, bool stimato, bool mista)? Classifica(
        PagamentoFornitore p)
    {
        if (p.Fattura is not null)
        {
            FatturaAcquisto fattura = p.Fattura;
            if (fattura.ImportoIva is decimal iva && fattura.Imponibile != 0)
            {
                decimal rateFraz = iva / fattura.Imponibile;
                if (rateFraz >= 0)
                {
                    decimal percent = Math.Round(rateFraz * 100m, 2, MidpointRounding.ToEven);
                    bool mista = !IvaCalculator.AliquoteAmmessePercentuali.Contains(percent);
                    return (percent, RigaBreakdownIvaCredito.FonteFattura, false, mista);
                }
            }

            // Fattura senza IVA persistita (o incoerente): stima su aliquota fornitore
            return (AliquotaFornitore(fattura.Fornitore), RigaBreakdownIvaCredito.FonteFattura, true, false);
        }

        if (p.Ddt is not null)
        {
            return (AliquotaFornitore(p.Ddt.Fornitore), RigaBreakdownIvaCredito.FonteDdt, true, false);
        }

        return null;
    }

    private static decimal AliquotaFornitore(Fornitore? fornitore)
        => fornitore?.AliquotaIva ?? AliquotaFallbackPercent;
}
