using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using duedgusto.Common;
using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.GraphQL.Fornitori;
using duedgusto.Services.Fornitori;

namespace duedgusto.Services.ChiusureMensili;

/// <summary>
/// Domain service per la gestione delle chiusure mensili con validazioni business e audit completo.
/// Implementa il pattern Aggregate Root per garantire coerenza dei dati.
/// </summary>
public class ChiusuraMensileService
{
    private readonly AppDbContext _dbContext;
    private readonly ChiusuraMensileValidator _validator;
    private readonly DocumentiFornitoreService _documentiService;
    private readonly ILogger<ChiusuraMensileService>? _logger;

    public ChiusuraMensileService(
        AppDbContext dbContext,
        ChiusuraMensileValidator validator,
        DocumentiFornitoreService? documentiService = null,
        ILogger<ChiusuraMensileService>? logger = null)
    {
        _dbContext = dbContext;
        _validator = validator;
        // Fallback per i test unitari che costruiscono il service senza DI:
        // il servizio documenti dipende solo dallo stesso AppDbContext scoped.
        _documentiService = documentiService ?? new DocumentiFornitoreService(dbContext);
        _logger = logger;
    }

    /// <summary>
    /// Crea una nuova chiusura mensile in stato BOZZA.
    /// I registri del mese NON vengono collegati qui: l'insieme è definito in un unico posto
    /// (<see cref="SincronizzaRegistriBozzaAsync"/>) e viene materializzato alla prima lettura.
    /// </summary>
    /// <param name="anno">Anno della chiusura (es. 2026)</param>
    /// <param name="mese">Mese della chiusura (1-12)</param>
    /// <returns>Chiusura mensile creata con relazioni caricate</returns>
    /// <exception cref="InvalidOperationException">Se la chiusura del mese esiste già</exception>
    public async Task<ChiusuraMensile> CreaChiusuraAsync(int anno, int mese)
    {
        // 1. Validazione input
        if (mese < 1 || mese > 12)
            throw new ArgumentException("Il mese deve essere tra 1 e 12", nameof(mese));

        if (anno < 2000 || anno > 2100)
            throw new ArgumentException("Anno non valido", nameof(anno));

        // 2. Verifica chiusura già esistente
        ChiusuraMensile? esistente = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.Anno == anno && c.Mese == mese);

        if (esistente != null)
        {
            throw new InvalidOperationException(
                $"Chiusura mensile per {mese:D2}/{anno} già esistente (ID: {esistente.ChiusuraId})"
            );
        }

        // 3. Creazione chiusura: una sola insert, nessuna transazione esplicita necessaria.
        // Se il collegamento dei registri fallisse, la lettura successiva lo rifarebbe comunque.
        var chiusura = new ChiusuraMensile
        {
            Anno = anno,
            Mese = mese,
            Stato = "BOZZA",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // 4. Ricarica: la lettura sincronizza i registri e popola le proprietà calcolate
        return await GetChiusuraConRelazioniAsync(chiusura.ChiusuraId)
            ?? throw new InvalidOperationException("Errore nel recupero della chiusura appena creata");
    }

    /// <summary>
    /// Chiude definitivamente una chiusura mensile (transizione BOZZA → CHIUSA).
    /// Una volta chiusa, i registri inclusi non possono più essere modificati o eliminati.
    /// </summary>
    /// <param name="chiusuraId">ID della chiusura da chiudere</param>
    /// <param name="utenteId">ID dell'utente che effettua la chiusura (opzionale)</param>
    /// <returns>True se chiusura avvenuta con successo</returns>
    /// <exception cref="InvalidOperationException">Se chiusura non trovata, già chiusa o invalida</exception>
    public async Task<bool> ChiudiMensileAsync(int chiusuraId, int? utenteId = null)
    {
        ChiusuraMensile? chiusura = await GetChiusuraConRelazioniAsync(chiusuraId);

        if (chiusura == null)
            return false;

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                $"Impossibile chiudere: stato attuale è '{chiusura.Stato}', deve essere 'BOZZA'"
            );
        }

        // Validazioni + transizione di stato in transazione esplicita (pattern try/commit/
        // catch/rollback degli orchestrator): un errore a metà lascia la chiusura in BOZZA
        // e garantisce lettura coerente validazione → write.
        await using IDbContextTransaction transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // Validazione completezza registri prima della chiusura definitiva
            List<DateTime> giorniMancanti = await ValidaCompletezzaRegistriAsync(chiusura.Anno, chiusura.Mese);

            // Sottrai giorni esclusi
            HashSet<DateTime> esclusi = chiusura.GiorniEsclusi != null
                    ? JsonSerializer.Deserialize<List<GiornoEscluso>>(chiusura.GiorniEsclusi)!
                        .Select(e => e.Data.Date).ToHashSet()
                    : new HashSet<DateTime>();
            var giorniEffettivamenteMancanti = giorniMancanti.Where(d => !esclusi.Contains(d.Date)).ToList();

            if (giorniEffettivamenteMancanti.Any())
            {
                var giorniFormattati = string.Join(", ", giorniEffettivamenteMancanti.Select(d => d.ToString("dd/MM/yyyy")));
                throw new InvalidOperationException(
                    $"Impossibile chiudere: registri giornalieri mancanti per: {giorniFormattati}"
                );
            }

            // Validazione business rules
            if (chiusura.RicavoTotaleCalcolato <= 0)
            {
                throw new InvalidOperationException(
                    "Impossibile chiudere: ricavi totali pari a zero. Verificare i registri cassa inclusi."
                );
            }

            // Transizione stato
            chiusura.Stato = "CHIUSA";
            chiusura.ChiusaDa = utenteId;
            chiusura.ChiusaIl = DateTime.UtcNow;
            chiusura.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        // Validazione di completezza NON BLOCCANTE (WARNING): la chiusura è già avvenuta.
        // Segnala eventuali registri/pagamenti del mese non inclusi, senza impedire la chiusura.
        List<string> avvisi = await ValidaCompletezzaChiusuraWarningsAsync(chiusuraId);
        chiusura.AvvisiCompletezza = avvisi;
        foreach (string avviso in avvisi)
        {
            _logger?.LogWarning("Chiusura {ChiusuraId} ({Mese:D2}/{Anno}): {Avviso}",
                chiusuraId, chiusura.Mese, chiusura.Anno, avviso);
        }

        return true;
    }

    /// <summary>
    /// Aggiorna i giorni esclusi dalla validazione della chiusura mensile.
    /// Permesso solo se la chiusura è in stato BOZZA.
    /// Ogni giorno escluso deve essere nel mese/anno della chiusura, un giorno operativo,
    /// e non deve avere un RegistroCassa esistente (nemmeno DRAFT).
    /// </summary>
    public async Task<ChiusuraMensile> AggiornaGiorniEsclusiAsync(
        int chiusuraId,
        List<GiornoEscluso> giorniEsclusi)
    {
        ChiusuraMensile? chiusura = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                "Impossibile modificare i giorni esclusi: la chiusura non è in stato BOZZA"
            );
        }

        // Carica i periodi di programmazione e i giorni operativi globali come fallback
        List<PeriodoProgrammazione> periodi = await _dbContext.PeriodiProgrammazione
                .OrderBy(p => p.DataInizio)
                .ToListAsync();
        BusinessSettings settings = await _dbContext.BusinessSettings.FirstAsync();
        var operatingDaysGlobali = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;

        var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        foreach (GiornoEscluso giorno in giorniEsclusi)
        {
            DateTime data = giorno.Data.Date;

            // Deve essere nel mese/anno della chiusura
            if (data < primoGiorno || data > ultimoGiorno)
            {
                throw new InvalidOperationException(
                    $"La data {data:dd/MM/yyyy} non appartiene al mese {chiusura.Mese:D2}/{chiusura.Anno}"
                );
            }

            // Determina i giorni operativi per questa data (per-periodo o fallback globale)
            int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;
            bool isOperativo;

            if (periodi.Count > 0)
            {
                var dataOnly = DateOnly.FromDateTime(data);
                PeriodoProgrammazione? periodo = periodi.FirstOrDefault(p =>
                            p.DataInizio <= dataOnly &&
                            (p.DataFine == null || p.DataFine >= dataOnly));

                if (periodo == null)
                {
                    isOperativo = false;
                }
                else
                {
                    var operatingDaysPeriodo = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi);
                    isOperativo = operatingDaysPeriodo != null && operatingDaysPeriodo.Length == 7
                        && operatingDaysPeriodo[operatingDayIndex];
                }
            }
            else
            {
                isOperativo = operatingDaysGlobali[operatingDayIndex];
            }

            // Deve essere un giorno operativo
            if (!isOperativo)
            {
                throw new InvalidOperationException(
                    $"La data {data:dd/MM/yyyy} non è un giorno operativo"
                );
            }

            // Non deve avere un RegistroCassa esistente (nemmeno DRAFT)
            var registroEsistente = await _dbContext.RegistriCassa
                .AnyAsync(r => r.Data.Date == data);
            if (registroEsistente)
            {
                throw new InvalidOperationException(
                    $"Impossibile escludere {data:dd/MM/yyyy}: esiste un registro cassa per questa data"
                );
            }
        }

        chiusura.GiorniEsclusi = giorniEsclusi.Count > 0
            ? JsonSerializer.Serialize(giorniEsclusi)
            : null;
        chiusura.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return await GetChiusuraConRelazioniAsync(chiusuraId)
            ?? throw new InvalidOperationException("Errore nel recupero della chiusura");
    }

    /// <summary>
    /// Valida la completezza dei registri cassa per un mese specifico.
    /// Utile per pre-validare prima di creare una chiusura.
    /// Utilizza i periodi di programmazione per determinare i giorni operativi
    /// di ciascun giorno del mese, gestendo anche mesi a cavallo tra due periodi.
    /// </summary>
    /// <param name="anno">Anno da validare</param>
    /// <param name="mese">Mese da validare (1-12)</param>
    /// <returns>Lista di date per cui mancano registri cassa chiusi</returns>
    public Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese)
        => _validator.ValidaCompletezzaRegistriAsync(anno, mese);

    /// <summary>
    /// Valida che una data (se fornita) appartenga al range [primo giorno, ultimo giorno] del
    /// mese/anno indicati. Stessa logica del filtro DataPagamento in CreaChiusuraAsync.
    /// Se <paramref name="data"/> è null non esegue alcuna validazione (data facoltativa).
    /// </summary>
    /// <exception cref="InvalidOperationException">Se la data è fuori dal mese della chiusura.</exception>
    private static void ValidaDataNelMese(DateTime? data, int anno, int mese)
    {
        if (!data.HasValue)
            return;

        var primoGiorno = new DateTime(anno, mese, 1);
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);
        DateTime giorno = data.Value.Date;

        if (giorno < primoGiorno || giorno > ultimoGiorno)
        {
            throw new InvalidOperationException(
                $"La data {giorno:dd/MM/yyyy} non appartiene al mese {mese:D2}/{anno} della chiusura. " +
                $"Deve essere compresa tra {primoGiorno:dd/MM/yyyy} e {ultimoGiorno:dd/MM/yyyy}."
            );
        }
    }

    /// <summary>
    /// Calcola gli avvisi di completezza NON bloccanti per una chiusura:
    /// (a) registri cassa CLOSED/RECONCILED del mese NON inclusi in RegistriInclusi.
    /// È di sola segnalazione: NON impedisce la chiusura.
    /// </summary>
    /// <returns>Lista di messaggi di avviso (vuota se tutto completo).</returns>
    public async Task<List<string>> ValidaCompletezzaChiusuraWarningsAsync(int chiusuraId)
    {
        var avvisi = new List<string>();

        ChiusuraMensile? chiusura = await GetChiusuraConRelazioniAsync(chiusuraId);
        if (chiusura == null)
            return avvisi;

        var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        // (a) Registri chiusi/riconciliati del mese non presenti tra i registri inclusi
        HashSet<int> registriInclusiIds = chiusura.RegistriInclusi
            .Select(r => r.RegistroId)
            .ToHashSet();

        List<RegistroCassa> registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
            .ToListAsync();

        var registriMancanti = registriMese
            .Where(r => !registriInclusiIds.Contains(r.Id))
            .OrderBy(r => r.Data)
            .ToList();

        if (registriMancanti.Count > 0)
        {
            var giorni = string.Join(", ", registriMancanti.Select(r => r.Data.ToString("dd/MM/yyyy")));
            avvisi.Add(
                $"Attenzione: {registriMancanti.Count} registro/i cassa chiuso/i del mese non incluso/i nella chiusura ({giorni})."
            );
        }

        return avvisi;
    }

    /// <summary>
    /// Recupera una chiusura con tutte le relazioni necessarie per calcolare le proprietà calcolate.
    /// Se è in BOZZA, prima riallinea i registri collegati (vedi <see cref="SincronizzaRegistriBozzaAsync"/>).
    /// </summary>
    /// <param name="chiusuraId">ID della chiusura</param>
    /// <returns>Chiusura con relazioni caricate o null se non trovata</returns>
    public async Task<ChiusuraMensile?> GetChiusuraConRelazioniAsync(int chiusuraId)
    {
        ChiusuraMensile? chiusura = await CaricaConRelazioniAsync(chiusuraId);

        if (chiusura == null)
            return null;

        await SincronizzaRegistriBozzaAsync(chiusura);
        return chiusura;
    }

    /// <summary>
    /// Recupera tutte le chiusure (opzionalmente filtrate per anno), riallineando i registri
    /// di quelle in BOZZA. Ordinamento: anno e mese decrescenti.
    /// </summary>
    public async Task<List<ChiusuraMensile>> GetChiusureAsync(int? anno)
    {
        IQueryable<ChiusuraMensile> query = _dbContext.ChiusureMensili
            .Include(c => c.ChiusaDaUtente)
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro);

        if (anno.HasValue)
        {
            query = query.Where(c => c.Anno == anno.Value);
        }

        List<ChiusuraMensile> chiusure = await query
            .OrderByDescending(c => c.Anno)
                .ThenByDescending(c => c.Mese)
            .ToListAsync();

        foreach (ChiusuraMensile chiusura in chiusure)
        {
            await SincronizzaRegistriBozzaAsync(chiusura);
        }

        return chiusure;
    }

    /// <summary>
    /// Carica la chiusura con le relazioni, SENZA sincronizzare: usato internamente dove la
    /// sincronizzazione è già avvenuta o non deve avvenire.
    /// </summary>
    private async Task<ChiusuraMensile?> CaricaConRelazioniAsync(int chiusuraId)
    {
        return await _dbContext.ChiusureMensili
            .Include(c => c.ChiusaDaUtente)
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);
    }

    /// <summary>
    /// Riallinea i registri collegati a una chiusura in BOZZA all'insieme corrente dei registri
    /// del suo mese — <b>tutti</b>, qualunque sia il loro stato.
    /// <para>
    /// È qui che vive la definizione dell'insieme, in un unico posto. La bozza non è uno
    /// snapshot: è una vista viva sul mese, così i suoi totali coincidono per costruzione con
    /// quelli della Vista mensile (che aggrega tutti i registri, bozze incluse). Lo snapshot
    /// nasce alla transizione BOZZA → CHIUSA: da quel momento questo metodo non tocca più nulla
    /// e i link persistiti restano congelati.
    /// </para>
    /// <para>
    /// Include anche i registri DRAFT "leggeri" creati per ospitare una spesa fissa su un giorno
    /// scoperto: senza di loro quelle spese sparirebbero dalla griglia della Chiusura Mensile.
    /// Un giorno operativo ancora in DRAFT impedisce comunque la chiusura definitiva, perché
    /// <see cref="ChiusuraMensileValidator"/> considera coperto solo un giorno CLOSED/RECONCILED.
    /// </para>
    /// <para>
    /// Il flag <c>Incluso</c> dei link già esistenti non viene mai toccato: un'esclusione
    /// manuale sopravvive alla sincronizzazione.
    /// </para>
    /// Precondizione: <paramref name="chiusura"/> deve avere <c>RegistriInclusi</c> già caricata.
    /// </summary>
    /// <returns>True se l'insieme dei link è cambiato.</returns>
    public async Task<bool> SincronizzaRegistriBozzaAsync(ChiusuraMensile chiusura)
    {
        if (chiusura.Stato != "BOZZA")
            return false;

        var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        List<RegistroCassa> registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .ToListAsync();

        HashSet<int> idMese = registriMese.Select(r => r.Id).ToHashSet();
        HashSet<int> idCollegati = chiusura.RegistriInclusi.Select(l => l.RegistroId).ToHashSet();

        List<RegistroCassaMensile> daAggiungere = registriMese
            .Where(r => !idCollegati.Contains(r.Id))
            .Select(r => new RegistroCassaMensile
            {
                ChiusuraId = chiusura.ChiusuraId,
                RegistroId = r.Id,
                Incluso = true,
                Registro = r,
            })
            .ToList();

        // Link orfani: registro eliminato o spostato in un altro mese.
        List<RegistroCassaMensile> daRimuovere = chiusura.RegistriInclusi
            .Where(l => !idMese.Contains(l.RegistroId))
            .ToList();

        if (daAggiungere.Count == 0 && daRimuovere.Count == 0)
            return false;

        _dbContext.RegistriCassaMensili.AddRange(daAggiungere);
        _dbContext.RegistriCassaMensili.RemoveRange(daRimuovere);

        try
        {
            await _dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            // Due letture concorrenti possono tentare lo stesso insert: la prima vince, questa
            // riparte dallo stato a DB. Non è un errore per il chiamante.
            _logger?.LogWarning(ex,
                "Sincronizzazione registri della chiusura {ChiusuraId} in conflitto: ricarico dal DB.",
                chiusura.ChiusuraId);

            daAggiungere.ForEach(link => _dbContext.Entry(link).State = EntityState.Detached);
            daRimuovere.ForEach(link => _dbContext.Entry(link).State = EntityState.Unchanged);

            await RicaricaRegistriInclusiAsync(chiusura);
            return true;
        }

        // Allinea il grafo in memoria: le proprietà calcolate leggono da questa collezione.
        // Il change tracker fa già il fixup delle navigazioni sulle entità che traccia, quindi
        // entrambe le operazioni sono difensive: senza il Contains i link entrerebbero due volte
        // e ogni totale della chiusura risulterebbe doppio.
        daAggiungere
            .Where(link => !chiusura.RegistriInclusi.Contains(link))
            .ToList()
            .ForEach(chiusura.RegistriInclusi.Add);

        daRimuovere.ForEach(link => chiusura.RegistriInclusi.Remove(link));

        return true;
    }

    /// <summary>
    /// Ricarica dal DB i link della chiusura e i registri referenziati. Serve solo nel percorso
    /// di conflitto della sincronizzazione, dove il grafo in memoria non è più attendibile.
    /// </summary>
    private async Task RicaricaRegistriInclusiAsync(ChiusuraMensile chiusura)
    {
        await _dbContext.Entry(chiusura)
            .Collection(c => c.RegistriInclusi)
            .LoadAsync();

        foreach (RegistroCassaMensile link in chiusura.RegistriInclusi)
        {
            await _dbContext.Entry(link)
                .Reference(l => l.Registro)
                .LoadAsync();
        }
    }

    /// <summary>
    /// Verifica se una data appartiene a un mese con chiusura in stato CHIUSA o RICONCILIATA.
    /// Usata come guard per impedire modifiche retroattive.
    /// </summary>
    public async Task<bool> DataAppartieneAMeseChiusoAsync(DateTime data)
    {
        return await _dbContext.ChiusureMensili
            .AnyAsync(c => c.Anno == data.Year && c.Mese == data.Month
                && (c.Stato == "CHIUSA" || c.Stato == "RICONCILIATA"));
    }

    /// <summary>
    /// Verifica se un registro cassa appartiene a un mese chiuso tramite il suo ID.
    /// </summary>
    public async Task<bool> RegistroAppartieneAMeseChiusoAsync(int registroId)
    {
        RegistroCassa? registro = await _dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == registroId);

        if (registro == null)
            return false;

        return await DataAppartieneAMeseChiusoAsync(registro.Data);
    }

    /// <summary>
    /// Collega il registro alla chiusura in BOZZA del suo mese, se ne esiste una e il link
    /// non c'è già.
    /// <para>
    /// Da quando <see cref="SincronizzaRegistriBozzaAsync"/> riallinea la bozza a ogni lettura,
    /// questo metodo non è più l'unica garanzia del link: è la scorciatoia che lo rende visibile
    /// già dentro la transazione della scrittura, anche a chi legge la join table senza passare
    /// dal service.
    /// </para>
    /// Non chiama SaveChanges: partecipa alla transazione del chiamante.
    /// </summary>
    public async Task EnsureRegistroLinkedToBozzaAsync(RegistroCassa registro)
    {
        ChiusuraMensile? bozza = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.Anno == registro.Data.Year
                && c.Mese == registro.Data.Month
                && c.Stato == "BOZZA");

        if (bozza == null)
            return;

        bool giaCollegato = await _dbContext.RegistriCassaMensili
            .AnyAsync(rm => rm.ChiusuraId == bozza.ChiusuraId && rm.RegistroId == registro.Id);

        if (giaCollegato)
            return;

        _dbContext.RegistriCassaMensili.Add(new RegistroCassaMensile
        {
            ChiusuraId = bozza.ChiusuraId,
            RegistroId = registro.Id,
            Incluso = true,
        });
    }
}
