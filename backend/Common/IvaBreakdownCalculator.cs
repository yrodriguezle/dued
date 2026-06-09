using duedgusto.Models;

namespace duedgusto.Common;

/// <summary>
/// Riga del breakdown IVA calcolata: aliquota in PERCENTUALE (es. 22.00),
/// importi a 2 decimali, <c>Stimato = true</c> per il residuo non itemizzato.
/// </summary>
public readonly record struct RigaBreakdownIva(
    decimal Aliquota,
    decimal Imponibile,
    decimal Imposta,
    bool Stimato);

/// <summary>
/// Esito del calcolo breakdown: righe + diagnostica del residuo.
/// <c>ResiduoClampato = true</c> quando <c>ResiduoOriginale &lt; 0</c> (dati storici
/// incoerenti): la riga stimata viene omessa e il chiamante deve loggare un warning.
/// </summary>
public readonly record struct EsitoBreakdownIva(
    IReadOnlyList<RigaBreakdownIva> Righe,
    decimal TotaleItemizzato,
    decimal ResiduoOriginale,
    bool ResiduoClampato);

/// <summary>
/// Calculator PURO del breakdown IVA per aliquota di un registro cassa
/// (nessun accesso DB, nessun logging — il warning di clamp è del chiamante).
///
/// <para><b>Parte esatta</b>: somma per aliquota degli snapshot di riga delle Vendite
/// (somma degli scorpori di riga, MAI scorporo della somma: garantisce
/// <c>Σ righe == Σ lordi</c> al centesimo), <c>Stimato = false</c>.</para>
///
/// <para><b>Residuo</b>: <c>totaleVendite − Σ PrezzoTotale</c>; se positivo, una sola
/// riga scorporata all'aliquota di default via <see cref="IvaCalculator.ScorporaDaLordo"/>,
/// <c>Stimato = true</c>; se zero, nessuna riga stimata; se negativo, clamp a 0
/// (decisione vincolante: mai bloccare il salvataggio cassa).</para>
/// </summary>
public static class IvaBreakdownCalculator
{
    /// <param name="vendite">Vendite del registro con snapshot di riga (AliquotaIva %, Imponibile, ImportoIva, PrezzoTotale).</param>
    /// <param name="totaleVendite">Totale vendite dichiarato del registro (lordo).</param>
    /// <param name="aliquotaDefault">Aliquota di default come FRAZIONE (BusinessSettings.VatRate), convenzione IvaCalculator.</param>
    public static EsitoBreakdownIva Calcola(
        IReadOnlyCollection<Vendita> vendite,
        decimal totaleVendite,
        decimal aliquotaDefault)
    {
        // Parte esatta: una riga per aliquota, ordinata per aliquota decrescente;
        // righe a importi tutti zero non emesse
        List<RigaBreakdownIva> righe = vendite
            .GroupBy(v => v.AliquotaIva)
            .Select(g => new RigaBreakdownIva(
                g.Key,
                g.Sum(v => v.Imponibile),
                g.Sum(v => v.ImportoIva),
                Stimato: false))
            .Where(r => r.Imponibile != 0 || r.Imposta != 0)
            .OrderByDescending(r => r.Aliquota)
            .ToList();

        decimal totaleItemizzato = vendite.Sum(v => v.PrezzoTotale);
        decimal residuo = totaleVendite - totaleItemizzato;
        bool residuoClampato = residuo < 0;

        if (residuo > 0)
        {
            RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(residuo, aliquotaDefault);
            righe.Add(new RigaBreakdownIva(
                aliquotaDefault * 100m,
                scorporo.Imponibile,
                scorporo.Iva,
                Stimato: true));
        }

        return new EsitoBreakdownIva(righe, totaleItemizzato, residuo, residuoClampato);
    }
}
