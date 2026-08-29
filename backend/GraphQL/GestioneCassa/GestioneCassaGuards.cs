using System.Text.Json;
using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Vendite;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa;

/// <summary>
/// Validazioni condivise per le mutation di GestioneCassa.
/// Classe statica pura — nessuna dipendenza, nessuna registrazione DI.
/// </summary>
public static class GestioneCassaGuards
{
    /// <summary>
    /// Verifica che la data non appartenga a un mese chiuso.
    /// </summary>
    public static async Task GuardMeseChiuso(ChiusuraMensileService chiusuraService, DateTime data)
    {
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(data))
        {
            throw new ExecutionError(
                $"Impossibile modificare il registro: il mese {data:MM/yyyy} è chiuso.");
        }
    }

    /// <summary>
    /// Verifica che la data non appartenga a un mese chiuso (variante per eliminazione).
    /// </summary>
    public static async Task GuardMeseChiusoPerEliminazione(ChiusuraMensileService chiusuraService, DateTime data)
    {
        if (await chiusuraService.DataAppartieneAMeseChiusoAsync(data))
        {
            throw new ExecutionError(
                $"Impossibile eliminare il registro: il mese {data:MM/yyyy} è chiuso.");
        }
    }

    /// <summary>
    /// Verifica che la data sia un giorno operativo usando i periodi di programmazione
    /// con fallback alle impostazioni globali quando non esiste alcun periodo.
    /// Guard unico e simmetrico per creazione e chiusura del registro: il verbo del
    /// messaggio d'errore è parametrizzato tramite <paramref name="azione"/>
    /// ("creare" per mutateRegistroCassa, "chiudere" per chiudiRegistroCassa).
    /// </summary>
    public static async Task GuardGiornoOperativoConPeriodi(
        AppDbContext dbContext, DateTime data, string azione = "creare")
    {
        BusinessSettings settings = await dbContext.BusinessSettings.FirstAsync();
        int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;
        var dataOnly = DateOnly.FromDateTime(data);

        List<PeriodoProgrammazione> periodi = await dbContext.PeriodiProgrammazione.ToListAsync();
        bool isOperatingDay;

        if (periodi.Count > 0)
        {
            PeriodoProgrammazione? periodo = periodi.FirstOrDefault(p =>
                      p.DataInizio <= dataOnly && (p.DataFine == null || p.DataFine >= dataOnly));

            if (periodo == null)
            {
                var nomeGiorno = data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
                throw new ExecutionError(
                    $"Impossibile {azione} un registro cassa: nessun periodo di programmazione copre la data ({nomeGiorno} {data:dd/MM/yyyy}).");
            }

            var giorniPeriodo = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi)!;
            isOperatingDay = giorniPeriodo[operatingDayIndex];
        }
        else
        {
            var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
            isOperatingDay = operatingDays[operatingDayIndex];
        }

        if (!isOperatingDay)
        {
            var nomeGiorno = data.ToString("dddd", new System.Globalization.CultureInfo("it-IT"));
            throw new ExecutionError(
                $"Impossibile {azione} un registro cassa per un giorno di chiusura ({nomeGiorno} {data:dd/MM/yyyy}).");
        }
    }

    /// <summary>
    /// L'utente appartiene a un ruolo con privilegi amministrativi?
    /// Il privilegio è dato dal flag <see cref="Ruolo.Amministratore"/> gestito
    /// dall'anagrafica ruoli, NON dal nome del ruolo: rinominare un ruolo non deve
    /// spostare i permessi.
    ///
    /// 🔴 È la forma <b>booleana</b> del controllo, ed esiste perché il verdetto è uno solo
    /// ma le forme d'errore sono due: <see cref="GuardUtenteAmministratore"/> lancia un
    /// <see cref="ExecutionError"/> — che è un tipo GraphQL e dentro un controller REST
    /// diventerebbe un 500 opaco — mentre i controller rispondono
    /// <c>403 { message }</c> con un corpo JSON che il client sa leggere.
    /// Una query, due presentazioni, zero duplicazione.
    /// </summary>
    public static async Task<bool> IsUtenteAmministratore(AppDbContext dbContext, int utenteId)
    {
        Ruolo? ruolo = await dbContext.Utenti
            .Where(u => u.Id == utenteId)
            .Select(u => u.Ruolo)
            .FirstOrDefaultAsync();

        return ruolo != null && ruolo.Amministratore;
    }

    /// <summary>
    /// Variante GraphQL di <see cref="IsUtenteAmministratore"/>: stesso verdetto, presentato
    /// come <see cref="ExecutionError"/> perché è ciò che i resolver sanno propagare al client.
    /// </summary>
    public static async Task GuardUtenteAmministratore(AppDbContext dbContext, int utenteId)
    {
        if (!await IsUtenteAmministratore(dbContext, utenteId))
        {
            throw new ExecutionError(
                "Operazione riservata agli amministratori: il tuo ruolo non ha i privilegi necessari.");
        }
    }

    /// <summary>
    /// Nessun ordine — di alcuno stato — è agganciato al registro che si sta per eliminare.
    ///
    /// <para>🔴 <b>Perché serve un guard e non basta la foreign key.</b>
    /// <c>Ordine → RegistroCassa</c> è <c>Restrict</c>, quindi il database rifiuta comunque
    /// l'eliminazione — ma lo fa con una <c>DbUpdateException</c> che al client arriva come un
    /// 500 opaco. Le <c>Vendita</c>, che invece cascatano, hanno abituato a un'altra semantica:
    /// senza questo controllo l'operatore vedrebbe un errore incomprensibile proprio dove prima
    /// l'eliminazione funzionava.</para>
    ///
    /// <para>⚠️ Si conta <b>ogni</b> ordine, non i soli aperti: un ordine chiuso o stornato è la
    /// storia di un incasso su quel giorno, e va tolta di mezzo consapevolmente prima di
    /// cancellare il registro che la contiene.</para>
    /// </summary>
    public static async Task GuardNessunOrdineSulRegistro(AppDbContext dbContext, int registroCassaId)
    {
        int ordini = await dbContext.Ordini.CountAsync(o => o.RegistroCassaId == registroCassaId);

        if (ordini > 0)
        {
            throw new ExecutionError(
                $"Impossibile eliminare il registro: contiene {ordini} " +
                $"ordine{(ordini == 1 ? "" : "i")} del punto vendita.");
        }
    }

    /// <summary>
    /// Nessun ordine del punto vendita è ancora <b>aperto</b> sul registro che si sta per chiudere.
    /// Un ordine aperto è per definizione un <b>incasso non dichiarato</b>: il conto è ancora al
    /// bancone, nessuna <c>Vendita</c> esiste e nessun secchio si è mosso. Chiudere la cassa così
    /// significherebbe dichiarare la giornata sapendo che una parte non è stata contata.
    ///
    /// <para>🔴 <b>Blocca se e solo se esiste almeno un ordine <see cref="StatiOrdine.Aperto"/>.</b>
    /// Non è una sfumatura di stile. In produzione la tabella <c>Ordini</c> è vuota e i registri
    /// sono centinaia: la chiusura di cassa è oggi un gesto manuale su giornate che <b>non hanno
    /// alcun ordine</b>. Una guardia che contasse gli ordini invece degli ordini <i>aperti</i>
    /// bloccherebbe tutte quelle giornate — e lo farebbe solo a fine turno, quando serve chiudere.
    /// <b>Zero ordini ⇒ nessun blocco</b>, comportamento identico a prima di questo change.</para>
    ///
    /// <para>⚠️ <b>Gli stati terminali non bloccano</b>, ognuno per la sua ragione:
    /// <see cref="StatiOrdine.Chiuso"/> ha già dichiarato il suo incasso;
    /// <see cref="StatiOrdine.Annullato"/> e <see cref="StatiOrdine.Stornato"/> sono gesti già
    /// risolti; <see cref="StatiOrdine.Splittato"/> soprattutto — il padre di uno split non ha nulla
    /// di indeciso, hanno incassato i suoi figli, e bloccare su di lui fermerebbe la cassa su un
    /// incasso <b>già dichiarato</b> <i>senza alcuna via d'uscita possibile</i>: un padre splittato
    /// non si può né chiudere né annullare.</para>
    ///
    /// <para>ℹ️ <b>Perché la differenza con <see cref="GuardNessunOrdineSulRegistro"/> è voluta.</b>
    /// Quella conta <b>ogni</b> ordine perché <b>elimina</b> il registro: un ordine chiuso è la
    /// storia di un incasso su quel giorno, con le sue <c>Vendita</c> agganciate, e va tolto di
    /// mezzo consapevolmente prima di cancellare il giorno che lo contiene. Questa ne conta uno
    /// solo di stato perché <b>chiude</b> il registro, e chiudere significa dichiarare ciò che è
    /// stato incassato: gli ordini già risolti sono esattamente ciò che si sta dichiarando.
    /// Criteri diversi per operazioni diverse, non una svista.</para>
    ///
    /// <para>ℹ️ <b>L'importo si somma dalle righe, non da <c>Ordine.TotaleOrdine</c>.</b> Quello
    /// snapshot si scrive alla chiusura dell'ordine e su un ordine aperto vale ancora 0: leggerlo
    /// produrrebbe un messaggio che annuncia «2 ordini aperti per 0,00 €» proprio mentre
    /// l'operatore cerca di capire quanto gli manca.</para>
    ///
    /// <para>La via d'uscita dal blocco è duplice ed è scritta nel messaggio: <b>incassare</b>
    /// l'ordine (<c>chiudiOrdine</c>) o <b>annullarlo</b> (<c>annullaOrdine</c>). L'annullo è quello
    /// sicuro, perché un ordine aperto non ha mai toccato nulla e non c'è alcun delta da disfare.</para>
    /// </summary>
    public static async Task GuardNessunOrdineAperto(AppDbContext dbContext, int registroCassaId)
    {
        // Una sola lettura: numero, suffisso e data del registro compongono l'identificativo
        // stampabile, la somma delle righe dà l'importo. La data arriva navigando dalla FK, non
        // con una seconda query.
        var aperti = await dbContext.Ordini
            .Where(o => o.RegistroCassaId == registroCassaId && o.Stato == StatiOrdine.Aperto)
            .OrderBy(o => o.Numero)
            .ThenBy(o => o.SuffissoSplit)
            .Select(o => new
            {
                o.Numero,
                o.SuffissoSplit,
                DataRegistro = o.RegistroCassa.Data,
                // Il cast a decimal? regge l'ordine aperto e ancora vuoto: su SQL una SUM senza
                // righe è NULL, non 0.
                Importo = o.Righe.Sum(r => (decimal?)r.PrezzoTotale) ?? 0m,
            })
            .ToListAsync();

        if (aperti.Count == 0)
        {
            return;
        }

        decimal totale = aperti.Sum(o => o.Importo);

        List<string> identificativi = aperti
            .Take(MaxOrdiniElencatiNelMessaggio)
            .Select(o => TransizioneOrdine.Identificativo(o.DataRegistro, o.Numero, o.SuffissoSplit))
            .ToList();

        if (aperti.Count > MaxOrdiniElencatiNelMessaggio)
        {
            identificativi.Add($"e altri {aperti.Count - MaxOrdiniElencatiNelMessaggio}");
        }

        string quanti = aperti.Count == 1
            ? "1 ordine ancora aperto"
            : $"{aperti.Count} ordini ancora aperti";

        string cosaFare = aperti.Count == 1
            ? "Va incassato o annullato prima di chiudere la cassa."
            : "Vanno incassati o annullati prima di chiudere la cassa.";

        throw new ExecutionError(
            $"Impossibile chiudere la cassa: {quanti} per {totale:N2} € " +
            $"({string.Join(", ", identificativi)}). {cosaFare}");
    }

    /// <summary>
    /// Quanti identificativi entrano nel messaggio prima di passare a «e altri N». Un elenco di
    /// venti codici non aiuta a decidere: l'elenco completo, con le due azioni per riga, è la
    /// schermata di chiusura cassa, non un messaggio d'errore.
    /// </summary>
    private const int MaxOrdiniElencatiNelMessaggio = 5;
}
