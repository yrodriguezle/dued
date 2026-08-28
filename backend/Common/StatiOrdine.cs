namespace duedgusto.Common;

/// <summary>
/// I cinque stati in cui può trovarsi un <c>Ordine</c> del punto vendita, e — cosa che qui conta
/// di più — quali di essi hanno <b>mosso i secchi</b> del registro.
///
/// <para>Sono stringhe e non un <c>enum</c> per la stessa ragione di
/// <see cref="MetodiPagamentoVendita"/> e di <c>RegistroCassa.Stato</c>: restano leggibili
/// guardando la tabella, e non si rinumerano da soli se un giorno se ne aggiunge uno in mezzo.
/// L'insieme resta chiuso perché <see cref="IsAmmesso"/> è l'unico ingresso.</para>
///
/// <para><b>La macchina a stati.</b> Le uniche transizioni ammesse sono queste, e non ce ne sono
/// altre raggiungibili da alcun percorso dell'API:</para>
/// <code>
///                     chiudiOrdine (1 taglio)
///         +---------------------------------------->  CHIUSO  --stornaOrdine-->  STORNATO
///         |                                              |                        (admin)
///         |           chiudiOrdine (n tagli)             |
///      APERTO ------------------------------> SPLITTATO -+   (i figli nascono CHIUSO)
///         |
///         +--annullaOrdine-->  ANNULLATO
/// </code>
///
/// <list type="table">
///   <listheader><term>Stato</term><description>Secchi · Vendita · RigaOrdine</description></listheader>
///   <item><term><see cref="Aperto"/></term><description>secchi <b>mai</b> toccati · nessuna
///   <c>Vendita</c> · righe mutabili</description></item>
///   <item><term><see cref="Chiuso"/></term><description>secchi mossi <b>una volta</b> ·
///   <c>Vendita</c> esistono · righe immutabili</description></item>
///   <item><term><see cref="Annullato"/></term><description>secchi mai toccati (non c'era nulla da
///   disfare) · nessuna <c>Vendita</c> · righe <b>conservate</b></description></item>
///   <item><term><see cref="Splittato"/></term><description>secchi mai toccati <i>da lui</i> — li
///   muovono i figli · nessuna <c>Vendita</c> · righe riassegnate ai figli</description></item>
///   <item><term><see cref="Stornato"/></term><description>delta inverso applicato <b>una
///   volta</b> · <c>Vendita</c> <b>cancellate</b> · righe <b>conservate</b></description></item>
/// </list>
///
/// <para>🔴 <b>La guardia della transizione non sta nel chiamante.</b> <c>Ordine.Stato</c> è
/// configurato come token di concorrenza (<c>IsConcurrencyToken()</c> in <c>AppDbContext</c>):
/// ogni UPDATE porta in coda <c>AND Stato = &lt;valore letto&gt;</c> e, se tocca zero righe, EF
/// lancia <c>DbUpdateConcurrencyException</c>. È questo — non una <c>SELECT</c> fatta prima — a
/// rendere la chiusura una-e-una-sola-volta, e serve perché <c>SecchiIncassiApplier.ApplicaDelta</c>
/// non è idempotente: applicarlo due volte raddoppia l'incasso in silenzio.</para>
/// </summary>
public static class StatiOrdine
{
    /// <summary>
    /// Il conto in corso al bancone. Non ha ancora incassato nulla: nessun secchio, nessuna
    /// <c>Vendita</c>, nessuna riga IVA. Le righe si aggiungono e si tolgono liberamente.
    /// </summary>
    public const string Aperto = "APERTO";

    /// <summary>
    /// Incassato: qui — e solo qui — sono nate le <c>Vendita</c> ed è stato applicato il delta
    /// sui secchi. Non si riapre e non si annulla: si <b>storna</b>.
    /// </summary>
    public const string Chiuso = "CHIUSO";

    /// <summary>
    /// Buttato via da aperto, con chi e quando (<c>AnnullatoDa</c>, <c>AnnullatoIl</c>,
    /// <c>MotivoAnnullamento</c>). Nessun delta, perché non c'era nulla da disfare.
    ///
    /// <para>L'ordine <b>non sparisce</b>: è la via d'uscita che sblocca la chiusura di cassa
    /// quando resta aperto un conto che nessuno incasserà, e una scappatoia senza traccia non
    /// controlla niente.</para>
    /// </summary>
    public const string Annullato = "ANNULLATO";

    /// <summary>
    /// Il padre di un conto diviso. Stato <b>terminale</b>: non ha incassato nulla di suo — hanno
    /// incassato gli n figli, che nascono già <see cref="Chiuso"/> con le righe riassegnate.
    ///
    /// <para>🔴 Non è un dettaglio di modellazione: senza questo stato il padre resterebbe
    /// <see cref="Aperto"/> per sempre, bloccando la chiusura di cassa su un incasso <b>già
    /// dichiarato</b> dai figli, e non sarebbe nemmeno annullabile senza mentire. Riusare
    /// <see cref="Annullato"/> sarebbe altrettanto falso: quello significa «non ha mai incassato
    /// nulla», e riempirebbe di ordini regolari un elenco che serve al controllo.</para>
    ///
    /// <para>Un ordine <c>SPLITTATO</c> <b>non è stornabile</b>: si stornano i figli, uno per uno.
    /// Un solo gesto che applica n delta inversi trasformerebbe «una volta sola» in n
    /// ragionamenti da tenere insieme.</para>
    /// </summary>
    public const string Splittato = "SPLITTATO";

    /// <summary>
    /// Incasso disfatto: delta inverso applicato una volta sola e <c>Vendita</c> <b>cancellate</b>
    /// — l'invariante è «una <c>Vendita</c> che esiste è una riga incassata adesso».
    ///
    /// <para>Le <c>RigaOrdine</c> restano: insieme a <c>StornatoDa</c>, <c>StornatoIl</c> e
    /// <c>MotivoStorno</c> sono l'unica traccia rimasta di ciò che era stato incassato. Senza di
    /// esse lo storno sarebbe indistinguibile da un ordine mai esistito.</para>
    /// </summary>
    public const string Stornato = "STORNATO";

    public static readonly IReadOnlyList<string> Ammessi =
    [
        Aperto,
        Chiuso,
        Annullato,
        Splittato,
        Stornato,
    ];

    public static bool IsAmmesso(string? stato) =>
        stato is not null && Ammessi.Contains(stato, StringComparer.Ordinal);
}
