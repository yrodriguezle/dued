using duedgusto.Common;

namespace duedgusto.Models;

/// <summary>
/// Il conto aperto al bancone: n consumazioni battute una dopo l'altra, un solo metodo di
/// pagamento scelto alla fine.
///
/// <para>🔴 <b>Un ordine aperto non è un incasso.</b> Finché lo stato è
/// <see cref="StatiOrdine.Aperto"/> non esiste alcuna <c>Vendita</c>, nessun secchio del registro
/// si è mosso e nessuna riga IVA è stata scritta. L'incasso si forma <b>solo</b> nella transizione
/// di chiusura, che è l'unico punto del backend in cui si muove un secchio.</para>
///
/// <para>È anche il <b>libro mastro</b> del punto vendita: un ordine non si cancella mai, in
/// nessuno dei suoi esiti. Annullato, splittato o stornato che sia, resta consultabile con le sue
/// righe, con chi ha agito e quando — vedi <see cref="StatiOrdine"/> per la macchina a stati.</para>
/// </summary>
public class Ordine
{
    public int OrdineId { get; set; }

    /// <summary>
    /// ⚠️ <b>Fissato all'apertura e mai ricalcolato alla chiusura.</b> Decisione della issue #24:
    /// «ordine a cavallo di mezzanotte: non si gestisce; finché la cassa non si chiude, tutto resta
    /// nel giorno di apertura». Un ordine aperto alle 23:50 e chiuso alle 00:20 incassa sul
    /// registro di <b>ieri</b>, ed è voluto.
    ///
    /// <para>Il corollario non è ovvio: l'elenco degli ordini aperti <b>non</b> va filtrato sul
    /// registro di oggi, o quell'ordine sparirebbe dalla lista proprio mentre è l'unico a bloccare
    /// la chiusura di cassa.</para>
    /// </summary>
    public int RegistroCassaId { get; set; }

    /// <summary>
    /// Progressivo <b>per registro</b>, assegnato all'apertura.
    ///
    /// <para>🔴 Il calcolo <c>MAX(Numero) + 1</c> ha una corsa: due aperture concorrenti leggono lo
    /// stesso massimo. È l'indice unico <c>(RegistroCassaId, Numero, SuffissoSplit)</c> dichiarato
    /// in <c>AppDbContext</c> a trasformare quella corsa da duplicato <b>muto</b> — due ticket
    /// stampati indistinguibili, scoperti quando qualcuno incassa quello sbagliato — in un insert
    /// fallito e ritentabile.</para>
    /// </summary>
    public int Numero { get; set; }

    /// <summary>
    /// <c>"A"</c>, <c>"B"</c>, … sui figli di uno split; <see cref="string.Empty"/> su tutti gli
    /// altri.
    ///
    /// <para>🔴 <b>Vuoto e non <c>null</c>, ed è la stringa che regge l'indice unico.</b> In MySQL
    /// (come in Sqlite) più <c>NULL</c> sono considerati distinti dentro un indice unico: se questa
    /// colonna fosse nullable, la terna <c>(RegistroCassaId, Numero, NULL)</c> sarebbe duplicabile
    /// senza errore — cioè l'indice smetterebbe di proteggere proprio il caso normale, l'ordine non
    /// splittato, che è la quasi totalità.</para>
    /// </summary>
    public string SuffissoSplit { get; set; } = string.Empty;

    /// <summary>
    /// Uno dei cinque valori di <see cref="StatiOrdine"/>.
    ///
    /// <para>🔴 <b>È un token di concorrenza</b> (<c>IsConcurrencyToken()</c> in
    /// <c>AppDbContext</c>): è questo campo a rendere ogni transizione
    /// una-e-una-sola-volta. Ogni UPDATE porta in coda <c>AND Stato = &lt;valore letto&gt;</c>, e
    /// zero righe toccate diventano <c>DbUpdateConcurrencyException</c> invece di un secondo delta
    /// sui secchi.</para>
    /// </summary>
    public string Stato { get; set; } = StatiOrdine.Aperto;

    /// <summary>
    /// Come è stato incassato: uno dei valori di <see cref="MetodiPagamentoVendita"/>.
    /// <c>null</c> finché l'ordine è aperto — la scelta del metodo è un gesto solo, a fine ordine,
    /// non uno per consumazione.
    /// </summary>
    public string? MetodoPagamento { get; set; }

    /// <summary>
    /// Snapshot della somma delle righe, scritto <b>alla chiusura</b>. Unico scrittore:
    /// l'orchestrator della chiusura. Mentre l'ordine è aperto vale 0 e il totale si deriva dalle
    /// righe, che stanno ancora cambiando.
    /// </summary>
    public decimal TotaleOrdine { get; set; }

    /// <summary>
    /// Quanto ha dato il cliente, in contanti. Serve a mostrare all'operatore il <b>resto da
    /// rendere</b> (<c>ContanteRicevuto − TotaleOrdine</c>), che si calcola e non si salva.
    ///
    /// <para>🔴 <b>Perché non si chiama <c>Resto</c>.</b> <c>RegistroCassa.Resto</c> esiste già ed è
    /// la colonna AG del foglio di chiusura — «Ecc al netto delle spese con scontrino» — che non
    /// c'entra nulla con i soldi restituiti al cliente. Riusare quel nome qui creerebbe un equivoco
    /// che poi non si toglie più, in codice, in UI e nello schema GraphQL.</para>
    ///
    /// <para>⚠️ Non è un dato contabile: non tocca alcun secchio, alcun totale del registro né
    /// alcuna riga IVA. È un aiuto all'operatore, e basta.</para>
    /// </summary>
    public decimal? ContanteRicevuto { get; set; }

    /// <summary>
    /// Self-FK valorizzata <b>solo sui figli</b> di uno split. Il padre resta e passa a
    /// <see cref="StatiOrdine.Splittato"/>: non diventa uno dei tagli, o porterebbe un metodo di
    /// pagamento con cui non ha incassato il proprio importo.
    /// </summary>
    public int? OrdinePadreId { get; set; }

    /// <summary>Utente che ha aperto l'ordine.</summary>
    public int? ApertoDa { get; set; }

    public DateTime ApertoIl { get; set; } = DateTime.UtcNow;

    /// <summary>Utente che ha incassato.</summary>
    public int? ChiusoDa { get; set; }

    public DateTime? ChiusoIl { get; set; }

    /// <summary>Utente che ha annullato l'ordine da aperto.</summary>
    public int? AnnullatoDa { get; set; }

    public DateTime? AnnullatoIl { get; set; }

    public string? MotivoAnnullamento { get; set; }

    /// <summary>
    /// Utente — <b>amministratore</b> — che ha stornato l'incasso. L'asimmetria con l'annullo è
    /// voluta: annullare un ordine aperto è per chiunque venda, disfare un incasso già dichiarato
    /// no.
    /// </summary>
    public int? StornatoDa { get; set; }

    public DateTime? StornatoIl { get; set; }

    /// <summary>
    /// 🔴 <b>Obbligatorio quando si storna</b>, e vuoto non vale. Lo storno cancella le
    /// <c>Vendita</c> generate: senza questi tre campi sarebbe un modo silenzioso di far sparire un
    /// incasso, e l'unica traccia rimasta sono l'ordine e le sue righe.
    /// </summary>
    public string? MotivoStorno { get; set; }

    public string? Note { get; set; }

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Ordine? OrdinePadre { get; set; }

    /// <summary>I tagli nati da uno split. Vuota su tutti gli altri ordini.</summary>
    public ICollection<Ordine> Figli { get; set; } = [];

    /// <summary>
    /// Le voci battute. Non si cancellano mai, nemmeno allo storno: sono il libro mastro
    /// dell'ordine. Su uno split vengono <b>riassegnate</b> ai figli, non duplicate.
    /// </summary>
    public ICollection<RigaOrdine> Righe { get; set; } = [];

    /// <summary>
    /// Le vendite generate alla chiusura. Esistono solo per un ordine
    /// <see cref="StatiOrdine.Chiuso"/>, e lo storno le <b>cancella</b>: una <c>Vendita</c> che
    /// esiste è una riga incassata adesso.
    /// </summary>
    public ICollection<Vendita> Vendite { get; set; } = [];
}
