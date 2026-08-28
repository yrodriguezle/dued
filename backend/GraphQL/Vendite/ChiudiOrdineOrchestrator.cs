using GraphQL;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.GraphQL.Vendite.Types;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;

namespace duedgusto.GraphQL.Vendite;

/// <summary>
/// L'incasso. È qui — e <b>solo</b> qui — che nasce una <c>Vendita</c> e che si muove un secchio
/// del registro: il punto unico di tutto il backend, ed è ciò che questo change esiste per
/// ottenere.
///
/// <para><b>L'ordine dei passi non è stile, è correttezza</b>, e ognuno dei tre vincoli qui sotto
/// ha un guasto silenzioso dietro di sé:</para>
/// <list type="number">
///   <item><b>La transizione di stato si salva per prima</b>, e con essa scatta la guardia
///   (<see cref="TransizioneOrdine"/>). Prima di quel <c>SaveChanges</c> nessun secchio è stato
///   toccato: se un altro dispositivo è già passato di qui, non c'è alcun delta da disfare.</item>
///   <item><b><c>SaveChangesAsync()</c> fra le <c>Vendita</c> e il breakdown è obbligatorio.</b>
///   <c>BreakdownIvaApplier</c> apre con <c>db.Vendite.Where(…).ToListAsync()</c>: è una query al
///   provider, non una lettura del change tracker, e le entità solo <c>Add</c>-ate non ci sono.
///   Dimenticarlo non produce alcun errore — la mutation risponde OK, l'ordine risulta chiuso, i
///   secchi si sono mossi — e lascia il registro con la ripartizione IVA vecchia di un ordine
///   intero, che si scopre a fine mese guardando una quadratura che non torna.</item>
///   <item><b>I secchi prima del breakdown.</b> Il breakdown calcola
///   <c>TotaleVendite = (Chiusura − Apertura) + IncassiElettronici + IncassiFattura</c>: leggere
///   <c>IncassiElettronici</c> prima del delta darebbe un totale vecchio di un ordine. È già
///   scritto nel commento di <c>SecchiIncassiApplier</c>, e vale identico qui.</item>
/// </list>
///
/// <para>⚠️ <b>Il breakdown si invoca UNA volta per chiusura, non una per taglio.</b> È un
/// ricalcolo completo — ricarica tutte le vendite del registro e rigenera tutte le righe IVA — e
/// le invocazioni intermedie di uno split leggerebbero <c>IncassiElettronici</c> aggiornato a
/// metà, perché i delta degli altri tagli non sono ancora stati applicati.</para>
/// </summary>
public class ChiudiOrdineOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;
    private readonly ILogger<ChiudiOrdineOrchestrator> _logger;

    public ChiudiOrdineOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus,
        ILogger<ChiudiOrdineOrchestrator> logger)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<EsitoChiusuraOrdine> ExecuteAsync(ChiudiOrdineInput input, int? utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        Ordine ordine = await db.Ordini
                .Include(o => o.Righe)
                .FirstOrDefaultAsync(o => o.OrdineId == input.OrdineId)
            ?? throw new ExecutionError($"Ordine con ID {input.OrdineId} non trovato.");

        RegistroCassa registro = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == ordine.RegistroCassaId)
            ?? throw new ExecutionError($"Registro cassa con ID {ordine.RegistroCassaId} non trovato.");

        string identificativo = TransizioneOrdine.Identificativo(ordine, registro.Data);

        TransizioneOrdine.GuardStatoAtteso(ordine, StatiOrdine.Aperto, identificativo);
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);

        // Il mese può chiudersi fra l'apertura e la chiusura dell'ordine, e il registro pure: si
        // ricontrolla adesso, non ci si fida di quanto valeva quando l'ordine è nato.
        if (registro.Stato is "CLOSED" or "RECONCILED")
        {
            throw new ExecutionError(
                $"Impossibile incassare l'ordine {identificativo}: il registro del " +
                $"{registro.Data:dd/MM/yyyy} è già chiuso. Vanno riaperti prima il registro, poi l'ordine.");
        }

        List<TaglioValidato> tagli = ValidaTagli(input, ordine, identificativo);

        DateTime adesso = DateTime.UtcNow;
        var ordiniGenerati = new List<Ordine>();

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (tagli.Count == 1)
            {
                ChiudiSemplice(db, ordine, tagli[0], utenteId, adesso);
            }
            else
            {
                ordiniGenerati.AddRange(Spacca(db, ordine, tagli, utenteId, adesso));
            }

            // 🔴 LA GUARDIA SCATTA QUI, e non è un SaveChanges qualunque: il token di concorrenza
            //    su Ordine.Stato fa sì che questa UPDATE porti in coda "AND Stato = 'APERTO'".
            //    Zero righe toccate significa che un altro dispositivo ha già chiuso, annullato o
            //    spaccato questo ordine, e l'eccezione arriva PRIMA di qualunque delta.
            //    È anche il SaveChanges obbligatorio del vincolo 2: senza, il breakdown qui sotto
            //    rileggerebbe dal database un insieme di vendite che non contiene queste.
            await TransizioneOrdine.SalvaTransizioneAsync(_unitOfWork, identificativo);

            // Un delta per taglio: gli importi sono disgiunti e la loro somma è il totale
            // dell'ordine, quindi ogni euro attraversa il secchio una volta e una sola.
            foreach (TaglioValidato taglio in tagli)
            {
                SecchiIncassiApplier.ApplicaDelta(registro, taglio.Metodo, taglio.Totale, _logger);
            }

            // Una volta sola, alla fine, quando TUTTI i delta sono stati applicati.
            BusinessSettings settings = await db.BusinessSettings.FirstAsync();
            await BreakdownIvaApplier.ApplicaAsync(db, registro, settings.VatRate, _logger);

            registro.UpdatedAt = adesso;
            await _unitOfWork.SaveChangesAsync();
        });

        // Eventi pubblicati DOPO il commit, come fa ChiudiRegistroCassaOrchestrator: un evento
        // emesso dentro la transazione racconterebbe un incasso che il rollback può ancora
        // cancellare.
        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = registro.Id,
            Data = registro.Data,
            Stato = registro.Stato,
            TotaleVendite = registro.TotaleVendite,
            TotaleApertura = registro.TotaleApertura,
            TotaleChiusura = registro.TotaleChiusura,
            Azione = "ORDINE_CHIUSO"
        });

        return new EsitoChiusuraOrdine
        {
            Ordine = ordine,
            OrdiniGenerati = ordiniGenerati,
            RestoDaRendere = tagli
                .Where(t => t.ContanteRicevuto.HasValue)
                .Sum(t => t.ContanteRicevuto!.Value - t.Totale),
        };
    }

    // ── Le due forme della chiusura ──────────────────────────────────────────────────────────────

    private static void ChiudiSemplice(
        AppDbContext db, Ordine ordine, TaglioValidato taglio, int? utenteId, DateTime adesso)
    {
        ordine.Stato = StatiOrdine.Chiuso;
        ordine.MetodoPagamento = taglio.Metodo;
        ordine.TotaleOrdine = taglio.Totale;
        ordine.ContanteRicevuto = taglio.ContanteRicevuto;
        ordine.ChiusoDa = utenteId;
        ordine.ChiusoIl = adesso;
        ordine.UpdatedAt = adesso;

        CreaVendite(db, ordine, taglio, adesso);
    }

    /// <summary>
    /// Lo split: il padre passa a <see cref="StatiOrdine.Splittato"/> e nascono n figli
    /// <see cref="StatiOrdine.Chiuso"/>, uno per metodo.
    ///
    /// <para>🔴 <b>Il padre non diventa uno dei tagli</b>, ed è la ragione per cui lo stato esiste:
    /// porterebbe un metodo di pagamento con cui non ha incassato il proprio importo — «ordine 017,
    /// chiuso in contanti, 12 €» quando ne aveva battuti 30 — cioè una riga che mente in ogni
    /// elenco e in ogni report. Il suo <c>MetodoPagamento</c> resta <c>null</c> per la stessa
    /// ragione, mentre <c>TotaleOrdine</c> conserva il totale intero: il padre dice quanto valeva,
    /// non come è stato pagato.</para>
    ///
    /// <para>Le righe vengono <b>riassegnate</b> ai figli, non duplicate: è così che un conto
    /// diviso si legge nella realtà, e il padre resta leggibile attraverso i figli.</para>
    /// </summary>
    private static List<Ordine> Spacca(
        AppDbContext db, Ordine ordine, List<TaglioValidato> tagli, int? utenteId, DateTime adesso)
    {
        ordine.Stato = StatiOrdine.Splittato;
        ordine.MetodoPagamento = null;
        ordine.TotaleOrdine = tagli.Sum(t => t.Totale);
        ordine.ChiusoDa = utenteId;
        ordine.ChiusoIl = adesso;
        ordine.UpdatedAt = adesso;

        var figli = new List<Ordine>();

        for (int i = 0; i < tagli.Count; i++)
        {
            TaglioValidato taglio = tagli[i];

            var figlio = new Ordine
            {
                RegistroCassaId = ordine.RegistroCassaId,
                // Stesso numero del padre: un figlio non consuma un progressivo, si distingue per
                // suffisso. 017-A e 017-B si leggono come «le due metà del 017», che è ciò che
                // sono, e l'indice unico regge sulla terna completa.
                Numero = ordine.Numero,
                SuffissoSplit = Suffisso(i),
                Stato = StatiOrdine.Chiuso,
                MetodoPagamento = taglio.Metodo,
                TotaleOrdine = taglio.Totale,
                ContanteRicevuto = taglio.ContanteRicevuto,
                OrdinePadre = ordine,
                ApertoDa = ordine.ApertoDa,
                ApertoIl = ordine.ApertoIl,
                ChiusoDa = utenteId,
                ChiusoIl = adesso,
                CreatedAt = adesso,
                UpdatedAt = adesso,
            };

            db.Ordini.Add(figlio);

            // Navigazione e non FK: il figlio non ha ancora un OrdineId — lo avrà dal database al
            // SaveChanges — ed è EF a propagarlo alle righe e alle vendite nell'ordine giusto.
            foreach (RigaOrdine riga in taglio.Righe)
            {
                riga.Ordine = figlio;
                riga.UpdatedAt = adesso;
            }

            CreaVendite(db, figlio, taglio, adesso);
            figli.Add(figlio);
        }

        return figli;
    }

    /// <summary>
    /// Una <c>Vendita</c> per ogni riga del taglio, con prezzo e aliquota <b>ereditati dalla
    /// riga</b> — cioè congelati quando la voce è stata battuta, non ripresi dal listino adesso: è
    /// il prezzo detto al cliente, e un ritocco a ordine aperto non deve cambiare il conto sotto
    /// al cliente.
    ///
    /// <para>Lo scorporo IVA passa da <c>VenditeMutations.RicalcolaImportiSnapshot</c>, che è
    /// l'unico posto in cui vive: riscriverlo qui creerebbe un secondo luogo dove l'invariante
    /// <c>Imponibile + ImportoIva == PrezzoTotale</c> può divergere.</para>
    /// </summary>
    private static void CreaVendite(AppDbContext db, Ordine ordine, TaglioValidato taglio, DateTime adesso)
    {
        foreach (RigaOrdine riga in taglio.Righe)
        {
            var vendita = new Vendita
            {
                RegistroCassaId = ordine.RegistroCassaId,
                ProdottoId = riga.ProdottoId,
                Quantita = riga.Quantita,
                PrezzoUnitario = riga.PrezzoUnitario,
                PrezzoTotale = riga.PrezzoTotale,
                AliquotaIva = riga.AliquotaIva,
                Note = riga.Note,
                // L'ora in cui la voce è stata battuta, non quella dell'incasso: è l'unica delle
                // due che dice qualcosa in più di quanto già non dica l'ordine.
                DataOra = riga.DataOra,
                MetodoPagamento = taglio.Metodo,
                Ordine = ordine,
                CreatedAt = adesso,
                UpdatedAt = adesso,
            };

            VenditeMutations.RicalcolaImportiSnapshot(vendita);
            db.Vendite.Add(vendita);
        }
    }

    /// <summary>«A», «B», … — l'alfabeto basta: oltre 26 modi di pagare lo stesso conto non c'è un
    /// problema di suffissi, c'è un problema diverso.</summary>
    private static string Suffisso(int indice) => ((char)('A' + indice)).ToString();

    // ── Validazione ──────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Tutta la validazione avviene <b>prima</b> di qualunque scrittura, ed è il motivo per cui il
    /// caso «split rifiutato» non ha bisogno di un rollback: non c'è niente da annullare.
    ///
    /// <para>Il controllo che conta è la <b>partizione esatta</b>: ogni voce dell'ordine in
    /// esattamente una parte. Una voce dimenticata sparirebbe dall'incasso in silenzio — nessuno
    /// se ne accorgerebbe, perché la somma dei figli tornerebbe con sé stessa — e una voce in due
    /// parti la farebbe incassare due volte.</para>
    /// </summary>
    private static List<TaglioValidato> ValidaTagli(ChiudiOrdineInput input, Ordine ordine, string identificativo)
    {
        if (input.Tagli.Count == 0)
        {
            throw new ExecutionError(
                $"Impossibile chiudere l'ordine {identificativo}: va indicato almeno un metodo di pagamento.");
        }

        if (ordine.Righe.Count == 0)
        {
            throw new ExecutionError(
                $"L'ordine {identificativo} non ha voci: non c'è nulla da incassare. Se il conto non " +
                "serve più, annullalo.");
        }

        Dictionary<int, RigaOrdine> righeDellOrdine = ordine.Righe.ToDictionary(r => r.RigaOrdineId);
        var giaAssegnate = new HashSet<int>();
        var validati = new List<TaglioValidato>();

        foreach (TaglioOrdineInput taglio in input.Tagli)
        {
            if (!MetodiPagamentoVendita.IsAmmesso(taglio.MetodoPagamento))
            {
                throw new ExecutionError(
                    $"Metodo di pagamento non ammesso: {taglio.MetodoPagamento}. Valori ammessi: " +
                    string.Join(", ", MetodiPagamentoVendita.Ammessi) + ".");
            }

            if (taglio.RigheOrdineId.Count == 0)
            {
                // Il caso in cui si tenta la divisione per importo: si vorrebbero due parti sullo
                // stesso insieme di voci, e una delle due resta senza. Va detto perché, non solo
                // che è rifiutata.
                throw new ExecutionError(
                    $"Ogni parte dell'ordine {identificativo} deve contenere almeno una voce: il conto " +
                    "si divide per voci, non per importo.");
            }

            var righeDelTaglio = new List<RigaOrdine>();

            foreach (int rigaId in taglio.RigheOrdineId)
            {
                if (!righeDellOrdine.TryGetValue(rigaId, out RigaOrdine? riga))
                {
                    throw new ExecutionError(
                        $"La voce {rigaId} non appartiene all'ordine {identificativo}.");
                }

                if (!giaAssegnate.Add(rigaId))
                {
                    throw new ExecutionError(
                        $"La voce «{DescriviRiga(riga)}» è stata assegnata a più di una parte. Ogni voce " +
                        "va in esattamente una parte: il conto si divide per voci, e la stessa voce non " +
                        "si può spezzare fra due metodi di pagamento.");
                }

                righeDelTaglio.Add(riga);
            }

            decimal totale = righeDelTaglio.Sum(r => r.PrezzoTotale);
            validati.Add(new TaglioValidato(
                taglio.MetodoPagamento,
                righeDelTaglio,
                totale,
                ValidaContanteRicevuto(taglio, totale)));
        }

        List<RigaOrdine> nonAssegnate = ordine.Righe
            .Where(r => !giaAssegnate.Contains(r.RigaOrdineId))
            .ToList();

        if (nonAssegnate.Count > 0)
        {
            throw new ExecutionError(
                $"Queste voci dell'ordine {identificativo} non sono state assegnate ad alcuna parte: " +
                string.Join(", ", nonAssegnate.Select(r => $"«{DescriviRiga(r)}»")) +
                ". Ogni voce deve finire in esattamente una parte, o sparirebbe dall'incasso.");
        }

        return validati;
    }

    /// <summary>
    /// Il contante ricevuto ha senso solo per i metodi in contanti, e solo se copre l'importo. Un
    /// resto negativo non è un numero valido da mostrare: è un conto non pagato.
    /// </summary>
    private static decimal? ValidaContanteRicevuto(TaglioOrdineInput taglio, decimal totale)
    {
        if (taglio.ContanteRicevuto is not { } ricevuto)
        {
            // Assente significa «importo esatto, non serve il conto»: è il caso normale.
            return null;
        }

        if (taglio.MetodoPagamento == MetodiPagamentoVendita.Elettronico)
        {
            throw new ExecutionError(
                "Il contante ricevuto non si indica per un pagamento elettronico: non c'è resto da rendere.");
        }

        if (ricevuto < totale)
        {
            throw new ExecutionError(
                $"Il contante ricevuto ({ricevuto:N2} €) non copre il totale da pagare ({totale:N2} €).");
        }

        return ricevuto;
    }

    private static string DescriviRiga(RigaOrdine riga)
        => $"riga {riga.RigaOrdineId} — {riga.Quantita:0.##} × {riga.PrezzoUnitario:N2} €";

    /// <summary>
    /// Un taglio dopo la validazione: il metodo è ammesso, le righe sono dell'ordine e di nessun
    /// altro taglio, il totale è calcolato dalle righe (mai dal client) e il contante ricevuto è
    /// coerente. Da qui in avanti non si controlla più nulla.
    /// </summary>
    private sealed record TaglioValidato(
        string Metodo,
        List<RigaOrdine> Righe,
        decimal Totale,
        decimal? ContanteRicevuto);
}
