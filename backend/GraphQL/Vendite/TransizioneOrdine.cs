using GraphQL;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;

namespace duedgusto.GraphQL.Vendite;

/// <summary>
/// La guardia che rende ogni transizione di un ordine <b>una-e-una-sola-volta</b>, e il punto
/// unico in cui quella garanzia è scritta.
///
/// <para>🔴 <b>Perché esiste.</b> <c>SecchiIncassiApplier.ApplicaDelta</c> non è idempotente per
/// costruzione — è dichiarato tale nel suo commento. Applicarlo due volte raddoppia l'incasso e
/// <b>nessun controllo a valle se ne accorge</b>: la quadratura del giorno torna comunque, perché
/// il secchio gonfiato è proprio quello che la quadratura usa come verità. Il doppio incasso non
/// si scopre guardando il registro: si scopre a fine mese, quando i conti non tornano e nessuno
/// sa più quale ordine fosse.</para>
///
/// <para><b>Un read-then-write non basta</b>, e non è un dettaglio teorico. Sotto
/// <c>REPEATABLE READ</c> — l'isolamento di default di InnoDB — due sessioni possono leggere
/// entrambe <c>Stato = 'APERTO'</c> e scrivere entrambe: la lettura non prende alcun lock. Ciò che
/// serializza è la <b>UPDATE condizionata</b>, che fa <i>current read</i> e prende il lock di riga:
/// la seconda si blocca fino al commit della prima, poi rivaluta il <c>WHERE</c>, non trova più
/// <c>APERTO</c> e tocca zero righe.</para>
///
/// <para><b>La forma scelta: token di concorrenza su <c>Ordine.Stato</c></b>
/// (<c>IsConcurrencyToken()</c> in <c>AppDbContext</c>). EF appende da sé
/// <c>AND Stato = &lt;valore letto&gt;</c> a ogni UPDATE dell'ordine, conta le righe toccate e
/// lancia <see cref="DbUpdateConcurrencyException"/> quando sono zero. Il confronto avviene dentro
/// il <c>SaveChanges</c> che serve comunque — quello che scrive metodo, totale, orario e le
/// <c>Vendita</c> nate dalla chiusura — quindi non c'è un secondo giro al database, e soprattutto
/// non c'è un secondo posto in cui lo stato può divergere.</para>
///
/// <para>⚠️ <b>L'alternativa scartata e perché.</b> <c>ExecuteUpdateAsync</c> con
/// <c>WHERE Stato = 'APERTO'</c> e conteggio esplicito delle righe darebbe la stessa garanzia — ma
/// <b>scavalca il change tracker</b>: l'<c>Ordine</c> già caricato resterebbe in memoria con lo
/// stato vecchio, e ogni lettura successiva dentro la stessa unit of work — compreso l'oggetto
/// restituito al client — mentirebbe finché qualcuno non aggiunge un <c>Reload()</c>. È
/// precisamente il passo che il prossimo bugfix dimentica, perché non ha sintomi finché non ne ha
/// di gravi. Costerebbe inoltre un round-trip in più, e obbligherebbe a ripetere a mano lo stato
/// atteso in ognuna delle tre transizioni, dove può divergere da quello davvero letto.</para>
///
/// <para>ℹ️ <b>Nessun <c>RowVersion</c>, e non è una dimenticanza.</b> Né MySQL né Sqlite
/// popolano da sé una colonna di versione: una simile colonna resterebbe ferma al suo valore
/// iniziale e la guardia <i>fingerebbe</i> di funzionare. Il token è lo <b>stato</b>, che
/// l'applicazione scrive comunque a ogni transizione — misurato nella fase di infrastruttura, non
/// dedotto.</para>
///
/// <para>🔴 <b>Il limite di ciò che i test provano.</b> Sqlite verifica la logica delle righe
/// toccate; il locking di riga di InnoDB sotto <c>REPEATABLE READ</c> non è riproducibile lì.
/// Verde qui significa «la guardia c'è ed è della forma giusta», non «su MySQL due operatori
/// concorrenti non possono incassare due volte» — quello poggia sulla semantica del motore,
/// descritta sopra.</para>
/// </summary>
public static class TransizioneOrdine
{
    /// <summary>
    /// Diagnosi <b>anticipata</b> dello stato: rifiuta subito, con un messaggio che nomina lo stato
    /// corrente e indica la via d'uscita, il caso normale in cui l'ordine è già transitato — la
    /// seconda chiusura, il retry di rete, l'annullo di un ordine già chiuso.
    ///
    /// <para>⚠️ <b>Non è la guardia.</b> È una cortesia verso l'operatore, che merita
    /// «quest'ordine è già chiuso» e non un errore di concorrenza. La garanzia
    /// una-e-una-sola-volta la dà <see cref="SalvaTransizioneAsync"/>, cioè il database: fra questo
    /// controllo e la scrittura c'è una finestra in cui un altro dispositivo può passare, e questo
    /// metodo da solo la lascerebbe aperta.</para>
    /// </summary>
    public static void GuardStatoAtteso(Ordine ordine, string statoAtteso, string identificativo)
    {
        if (ordine.Stato == statoAtteso)
        {
            return;
        }

        throw new ExecutionError(
            $"L'ordine {identificativo} è in stato {ordine.Stato}: {ViaDUscita(ordine.Stato, statoAtteso)}");
    }

    /// <summary>
    /// Salva la transizione facendo scattare la guardia, e traduce il conflitto in un errore che
    /// l'operatore può leggere.
    ///
    /// <para>Una <see cref="DbUpdateConcurrencyException"/> propagata diventerebbe un 500 opaco: al
    /// bancone non si distinguerebbe da un guasto di rete, e la reazione naturale — ritentare —
    /// sarebbe quella sbagliata da suggerire.</para>
    /// </summary>
    public static async Task SalvaTransizioneAsync(IUnitOfWork unitOfWork, string identificativo)
    {
        try
        {
            await unitOfWork.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Zero righe toccate: fra la lettura e la scrittura qualcun altro ha transito
            // l'ordine. Nessun delta è stato applicato — i secchi si muovono DOPO questo save,
            // mai prima — e la transazione del chiamante rotola indietro tutto il resto.
            throw new ExecutionError(
                $"L'ordine {identificativo} non è più nello stato in cui l'hai aperto: " +
                "potrebbe essere già stato chiuso, annullato o stornato da un altro dispositivo. " +
                "Ricarica gli ordini aperti e riprova.");
        }
    }

    /// <summary>
    /// L'identificativo stampabile: <c>{data:yyMMdd}-{numero:D3}</c>, più <c>-{suffisso}</c> sui
    /// figli di uno split. Derivato in lettura e <b>mai persistito</b>, come
    /// <c>prezzoEffettivoVetrina</c>: è la composizione di tre colonne che ci sono già.
    ///
    /// <para>Il segmento del suffisso compare quando la stringa <b>non è vuota</b> — non «quando
    /// non è null»: la colonna è NOT NULL e vale <c>""</c> su ogni ordine non splittato.</para>
    /// </summary>
    public static string Identificativo(DateTime dataRegistro, int numero, string suffissoSplit)
    {
        string radice = $"{dataRegistro:yyMMdd}-{numero:D3}";
        return string.IsNullOrEmpty(suffissoSplit) ? radice : $"{radice}-{suffissoSplit}";
    }

    /// <inheritdoc cref="Identificativo(DateTime, int, string)"/>
    public static string Identificativo(Ordine ordine, DateTime dataRegistro)
        => Identificativo(dataRegistro, ordine.Numero, ordine.SuffissoSplit);

    /// <summary>
    /// Che cosa dire all'operatore, che non deve dedurre dalla macchina a stati la mossa
    /// successiva. Un ordine chiuso non si riapre — si storna; uno annullato o stornato è
    /// terminale; un padre splittato rimanda ai figli.
    /// </summary>
    private static string ViaDUscita(string statoCorrente, string statoAtteso) => statoCorrente switch
    {
        StatiOrdine.Chiuso when statoAtteso == StatiOrdine.Aperto =>
            "è già stato incassato e non si riapre. Per disfare l'incasso serve uno storno.",
        StatiOrdine.Aperto when statoAtteso == StatiOrdine.Chiuso =>
            "non è ancora stato incassato, quindi non c'è nulla da stornare. Se il conto non va incassato, annullalo.",
        StatiOrdine.Splittato =>
            "è stato diviso in più parti: l'operazione va fatta sulle singole parti, una per una.",
        StatiOrdine.Annullato =>
            "è stato annullato, ed è uno stato definitivo.",
        StatiOrdine.Stornato =>
            "è già stato stornato, ed è uno stato definitivo.",
        _ =>
            $"l'operazione richiede un ordine in stato {statoAtteso}.",
    };
}
