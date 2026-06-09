namespace duedgusto.Common;

/// <summary>
/// Risultato di un calcolo IVA: la terna completa imponibile / IVA / totale lordo.
/// Invariante garantita: <c>Imponibile + Iva == Totale</c> al centesimo.
/// </summary>
public readonly record struct RisultatoIva(decimal Imponibile, decimal Iva, decimal Totale);

/// <summary>
/// Calculator IVA centralizzato — unica fonte delle formule IVA dell'applicazione.
///
/// <para><b>Convenzione aliquota: FRAZIONE</b> (es. <c>0.22</c> = 22%).
/// <c>BusinessSettings.VatRate</c> è già una frazione e passa diretto; i call site che
/// lavorano in percentuale (<c>AliquotaIva = 22</c> di fatture/fornitori) devono convertire
/// esplicitamente con <see cref="AliquotaDaPercentuale"/>.</para>
///
/// <para><b>Arrotondamento: <c>Math.Round(..., 2, MidpointRounding.ToEven)</c></b> —
/// è il default di <c>Math.Round</c>, reso esplicito. Mantiene bit-identici i valori
/// calcolati dalle formule inline preesistenti (che usavano il default implicito).</para>
///
/// <para><b>Nota di equivalenza con la vecchia formula di <c>CalcolaTotali</c></b>
/// (che arrotondava l'IVA invece dell'imponibile: <c>Round(lordo·a/(1+a), 2)</c>):
/// per un lordo con ≤2 decimali (i campi valuta sono decimal(10,2)) le parti frazionarie
/// oltre il secondo decimale di imponibile e IVA grezzi sono complementari, quindi una
/// arrotonda in su e l'altra in giù e <c>lordo − Round(lordo/(1+a), 2)</c> coincide con
/// <c>Round(lordo·a/(1+a), 2)</c>. Per le aliquote reali dell'applicazione (22%, 10%, 4%)
/// un lordo a 2 decimali non produce mai un midpoint esatto (es. con il 22% servirebbe
/// un quoziente con denominatore 61, primo), quindi i tie non alterano l'equivalenza.
/// Coperto da test unitario sui casi midpoint in <c>IvaCalculatorTests</c>.</para>
///
/// <para>Casi limite (definiti una sola volta): aliquota negativa →
/// <see cref="ArgumentOutOfRangeException"/>; aliquota 0 → IVA 0 e imponibile = totale;
/// importi negativi ammessi (rettifiche/storni, formule simmetriche).</para>
///
/// <para>Prerequisito Fase 3 (multialiquota): l'aliquota è sempre un parametro
/// dell'operazione, mai una costante interna.</para>
/// </summary>
public static class IvaCalculator
{
    /// <summary>
    /// Converte un'aliquota percentuale (es. <c>22</c>) nella frazione interna (<c>0.22</c>)
    /// richiesta dal calculator. Da chiamare esplicitamente nei call site che lavorano
    /// con la convenzione percentuale (<c>AliquotaIva</c> di fatture/fornitori).
    /// </summary>
    public static decimal AliquotaDaPercentuale(decimal percentuale) => percentuale / 100m;

    /// <summary>
    /// Scorporo IVA da totale lordo (prezzi IVA inclusa — registro cassa, fatture da pagamento).
    /// <c>Imponibile = Round(lordo / (1 + aliquota), 2, ToEven)</c>; <c>Iva = lordo − Imponibile</c>.
    /// L'IVA come differenza garantisce <c>Imponibile + Iva == lordo</c> al centesimo.
    /// </summary>
    /// <param name="lordo">Totale lordo IVA inclusa (negativo ammesso per storni).</param>
    /// <param name="aliquota">Aliquota come FRAZIONE (es. 0.22 = 22%); 0 ammessa, negativa vietata.</param>
    public static RisultatoIva ScorporaDaLordo(decimal lordo, decimal aliquota)
    {
        GuardAliquota(aliquota);

        decimal imponibile = Math.Round(lordo / (1 + aliquota), 2, MidpointRounding.ToEven);
        decimal iva = lordo - imponibile;
        return new RisultatoIva(imponibile, iva, lordo);
    }

    /// <summary>
    /// Applicazione IVA su imponibile (fatture acquisto inserite da imponibile).
    /// <c>Iva = Round(imponibile × aliquota, 2, ToEven)</c>; <c>Totale = imponibile + Iva</c>.
    /// </summary>
    /// <param name="imponibile">Imponibile (negativo ammesso per storni).</param>
    /// <param name="aliquota">Aliquota come FRAZIONE (es. 0.22 = 22%); 0 ammessa, negativa vietata.</param>
    public static RisultatoIva ApplicaSuImponibile(decimal imponibile, decimal aliquota)
    {
        GuardAliquota(aliquota);

        decimal iva = Math.Round(imponibile * aliquota, 2, MidpointRounding.ToEven);
        return new RisultatoIva(imponibile, iva, imponibile + iva);
    }

    private static void GuardAliquota(decimal aliquota)
    {
        if (aliquota < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(aliquota), aliquota, "L'aliquota IVA non può essere negativa.");
        }
    }
}
