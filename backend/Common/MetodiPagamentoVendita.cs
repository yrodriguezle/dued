namespace duedgusto.Common;

/// <summary>
/// I tre modi in cui un cliente paga una consumazione, e — cosa che qui conta di più — i tre
/// <b>secchi</b> del registro in cui quel denaro finisce.
///
/// <para>Sono stringhe e non un <c>enum</c> per la stessa ragione per cui lo è
/// <c>RegistroCassa.Stato</c> e <c>PagamentoFornitore.MetodoPagamento</c>: restano leggibili
/// guardando la tabella, e non si rinumerano da soli se un giorno se ne aggiunge uno in mezzo.
/// L'insieme resta chiuso perché <see cref="IsAmmesso"/> è l'unico ingresso.</para>
/// </summary>
public static class MetodiPagamentoVendita
{
    /// <summary>Finisce in <c>IncassiElettronici</c>, e da lì dentro <c>TotaleVendite</c>.</summary>
    public const string Elettronico = "ELETTRONICO";

    /// <summary>
    /// Finisce in <c>IncassoContanteTracciato</c>: alza <c>RestoFornitore</c> (colonna AD) e
    /// abbassa <c>Ecc</c> (AE). <b>Non</b> entra in <c>TotaleVendite</c> — quei soldi sono già
    /// contati dentro <c>Chiusura − Apertura</c>.
    /// </summary>
    public const string ContanteTracciato = "CONTANTE_TRACCIATO";

    /// <summary>
    /// 🔴 <b>Non scrive in nessun campo, ed è corretto così.</b> Il contante si conta una volta
    /// sola, contandolo: entra in <c>Chiusura − Apertura</c> che sia scontrinato o no.
    /// Tracciato e non tracciato non sono due posti diversi dove stanno i soldi, sono una
    /// <i>dichiarazione</i> sopra gli stessi soldi. Il non tracciato è già calcolato, per
    /// differenza: è esattamente <c>Ecc = ContanteNetto − contante tracciato</c>.
    ///
    /// <para>Battere questo metodo serve quindi solo a registrare <b>che cosa</b> è stato
    /// venduto — per la ripartizione IVA e le statistiche di prodotto — non <i>dove</i> sono
    /// finiti i soldi.</para>
    /// </summary>
    public const string ContanteNonTracciato = "CONTANTE_NON_TRACCIATO";

    public static readonly IReadOnlyList<string> Ammessi =
    [
        Elettronico,
        ContanteTracciato,
        ContanteNonTracciato,
    ];

    public static bool IsAmmesso(string? metodo) =>
        metodo is not null && Ammessi.Contains(metodo, StringComparer.Ordinal);
}
