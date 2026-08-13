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
    /// Set chiuso delle aliquote IVA ammesse per i prodotti, in PERCENTUALE.
    /// Costante centralizzata unica (nessuna duplicazione nei call site);
    /// la configurabilità da BusinessSettings è un'estensione futura.
    /// </summary>
    public static readonly IReadOnlyList<decimal> AliquoteAmmessePercentuali = new[] { 0m, 4m, 5m, 10m, 22m };

    /// <summary>
    /// True se l'aliquota (in percentuale, es. <c>22</c>) appartiene al set
    /// <see cref="AliquoteAmmessePercentuali"/>.
    /// </summary>
    public static bool IsAliquotaAmmessa(decimal percentuale)
        => AliquoteAmmessePercentuali.Contains(percentuale);

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

    // === IVA NOTA (nessuna aliquota nel calcolo) ===================================
    //
    // Le due operazioni sopra presuppongono che il documento abbia UNA aliquota. Non è
    // sempre vero: un Cash & Carry vende righe a 4/10/22% e sulla fattura stampa il solo
    // TOTALE IVA. In quel caso l'IVA è un DATO letto dal documento, non un risultato: le
    // due operazioni seguenti la accettano tale e quale e ricavano il terzo importo per
    // differenza, mantenendo l'invariante Imponibile + Iva == Totale.

    /// <summary>
    /// IVA nota, importi netti: l'operatore inserisce imponibile e IVA presi dal documento
    /// (fattura multialiquota). <c>Totale = imponibile + iva</c>.
    /// </summary>
    /// <param name="imponibile">Imponibile del documento (negativo ammesso per storni).</param>
    /// <param name="iva">Importo IVA letto dal documento.</param>
    public static RisultatoIva DaImportoEsplicito(decimal imponibile, decimal iva)
    {
        decimal imponibileArrotondato = Math.Round(imponibile, 2, MidpointRounding.ToEven);
        decimal imposta = Math.Round(iva, 2, MidpointRounding.ToEven);
        return new RisultatoIva(imponibileArrotondato, imposta, imponibileArrotondato + imposta);
    }

    /// <summary>
    /// IVA nota, importo lordo: si conosce il totale pagato e l'IVA stampata sul documento.
    /// <c>Imponibile = lordo − iva</c>, totale invariato — duale di
    /// <see cref="ScorporaDaLordo"/> con l'IVA come dato invece che come incognita.
    /// </summary>
    /// <param name="lordo">Totale lordo IVA inclusa (negativo ammesso per storni).</param>
    /// <param name="iva">Importo IVA letto dal documento.</param>
    public static RisultatoIva RipartisciConIvaNota(decimal lordo, decimal iva)
    {
        decimal imposta = Math.Round(iva, 2, MidpointRounding.ToEven);
        return new RisultatoIva(lordo - imposta, imposta, lordo);
    }

    /// <summary>
    /// Aliquota IMPLICITA in PERCENTUALE di un documento già valorizzato
    /// (<c>Iva / Imponibile</c>), oppure <c>null</c> se non derivabile: IVA assente,
    /// imponibile nullo, o rapporto negativo (dati incoerenti).
    ///
    /// <para>È un valore da MOSTRARE, non su cui decidere: su una fattura a IVA digitata la
    /// percentuale è una media ponderata e non corrisponde ad alcuna aliquota reale. La
    /// modalità di una fattura si legge da <c>FatturaAcquisto.IvaCalcolata</c>, non da qui.</para>
    /// </summary>
    public static decimal? AliquotaImplicitaPercentuale(decimal imponibile, decimal? iva)
    {
        if (iva is not decimal importoIva || imponibile == 0)
        {
            return null;
        }

        decimal frazione = importoIva / imponibile;
        return frazione < 0 ? null : Math.Round(frazione * 100m, 2, MidpointRounding.ToEven);
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
