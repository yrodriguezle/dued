using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;

namespace duedgusto.Services.ChiusureMensili;

/// <summary>
/// Domain service per la gestione delle chiusure mensili con validazioni business e audit completo.
/// Implementa il pattern Aggregate Root per garantire coerenza dei dati.
/// </summary>
public class ChiusuraMensileService
{
    private readonly AppDbContext _dbContext;

    public ChiusuraMensileService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Crea una nuova chiusura mensile con validazione completezza registri.
    /// Associa automaticamente tutti i registri cassa chiusi del mese e i pagamenti fornitori.
    /// </summary>
    /// <param name="anno">Anno della chiusura (es. 2026)</param>
    /// <param name="mese">Mese della chiusura (1-12)</param>
    /// <returns>Chiusura mensile creata con relazioni caricate</returns>
    /// <exception cref="InvalidOperationException">Se registri mancanti o chiusura già esistente</exception>
    public async Task<ChiusuraMensile> CreaChiusuraAsync(int anno, int mese)
    {
        // 1. Validazione input
        if (mese < 1 || mese > 12)
            throw new ArgumentException("Il mese deve essere tra 1 e 12", nameof(mese));

        if (anno < 2000 || anno > 2100)
            throw new ArgumentException("Anno non valido", nameof(anno));

        // 2. Calcolo date del mese
        var primoGiorno = new DateTime(anno, mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        // 3. Recupera registri chiusi/riconciliati del mese (senza bloccare la creazione)
        var registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
            .ToListAsync();

        // 4. Verifica chiusura già esistente
        var esistente = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.Anno == anno && c.Mese == mese);

        if (esistente != null)
        {
            throw new InvalidOperationException(
                $"Chiusura mensile per {mese:D2}/{anno} già esistente (ID: {esistente.ChiusuraId})"
            );
        }

        // 5. Creazione chiusura
        var chiusura = new ChiusuraMensile
        {
            Anno = anno,
            Mese = mese,
            Stato = "BOZZA",
            CreatoIl = DateTime.UtcNow,
            AggiornatoIl = DateTime.UtcNow
        };

        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        // 6. Associazione registri cassa
        foreach (var registro in registriMese)
        {
            var link = new RegistroCassaMensile
            {
                ChiusuraId = chiusura.ChiusuraId,
                RegistroId = registro.Id,
                Incluso = true
            };
            _dbContext.RegistriCassaMensili.Add(link);
        }

        // 7. Associazione automatica pagamenti fornitori del mese
        var pagamentiMese = await _dbContext.PagamentiFornitori
            .Where(p => p.DataPagamento >= primoGiorno && p.DataPagamento <= ultimoGiorno)
            .ToListAsync();

        foreach (var pagamento in pagamentiMese)
        {
            var linkPagamento = new PagamentoMensileFornitori
            {
                ChiusuraId = chiusura.ChiusuraId,
                PagamentoId = pagamento.PagamentoId,
                InclusoInChiusura = true
            };
            _dbContext.PagamentiMensiliFornitori.Add(linkPagamento);
        }

        await _dbContext.SaveChangesAsync();

        // 8. Ricarica con tutte le relazioni per calcolo proprietà calcolate
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
        var chiusura = await GetChiusuraConRelazioniAsync(chiusuraId);

        if (chiusura == null)
            return false;

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                $"Impossibile chiudere: stato attuale è '{chiusura.Stato}', deve essere 'BOZZA'"
            );
        }

        // Validazione completezza registri prima della chiusura definitiva
        var giorniMancanti = await ValidaCompletezzaRegistriAsync(chiusura.Anno, chiusura.Mese);

        // Sottrai giorni esclusi
        var esclusi = chiusura.GiorniEsclusi != null
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
        chiusura.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Aggiunge una spesa libera (non legata a fatture) alla chiusura.
    /// Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    /// <param name="chiusuraId">ID della chiusura</param>
    /// <param name="descrizione">Descrizione della spesa</param>
    /// <param name="importo">Importo della spesa (deve essere > 0)</param>
    /// <param name="categoria">Categoria della spesa</param>
    /// <returns>Spesa creata</returns>
    /// <exception cref="InvalidOperationException">Se chiusura non trovata o già chiusa</exception>
    public async Task<SpesaMensileLibera> AggiungiSpesaLiberaAsync(
        int chiusuraId,
        string descrizione,
        decimal importo,
        CategoriaSpesa categoria)
    {
        // Validazione input
        if (string.IsNullOrWhiteSpace(descrizione))
            throw new ArgumentException("Descrizione obbligatoria", nameof(descrizione));

        if (importo <= 0)
            throw new ArgumentException("Importo deve essere maggiore di zero", nameof(importo));

        // Verifica chiusura
        var chiusura = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                $"Impossibile aggiungere spese: la chiusura è in stato '{chiusura.Stato}'. Solo chiusure in stato BOZZA possono essere modificate."
            );
        }

        // Creazione spesa
        var spesa = new SpesaMensileLibera
        {
            ChiusuraId = chiusuraId,
            Descrizione = descrizione.Trim(),
            Importo = importo,
            Categoria = categoria,
            CreatoIl = DateTime.UtcNow,
            AggiornatoIl = DateTime.UtcNow
        };

        _dbContext.SpeseMensiliLibere.Add(spesa);

        // Aggiorna timestamp chiusura
        chiusura.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return spesa;
    }

    /// <summary>
    /// Include un pagamento fornitore nella chiusura mensile.
    /// Utile per aggiungere pagamenti effettuati dopo la creazione della chiusura.
    /// </summary>
    /// <param name="chiusuraId">ID della chiusura</param>
    /// <param name="pagamentoId">ID del pagamento fornitore</param>
    /// <returns>True se associazione riuscita</returns>
    /// <exception cref="InvalidOperationException">Se chiusura/pagamento non trovati o già associati</exception>
    public async Task<bool> IncludiPagamentoFornitoreAsync(int chiusuraId, int pagamentoId)
    {
        var chiusura = await _dbContext.ChiusureMensili
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                "Impossibile modificare pagamenti: la chiusura non è in stato BOZZA"
            );
        }

        var pagamento = await _dbContext.PagamentiFornitori
            .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId);

        if (pagamento == null)
            throw new InvalidOperationException($"Pagamento fornitore con ID {pagamentoId} non trovato");

        // Verifica se già associato
        var esistente = await _dbContext.PagamentiMensiliFornitori
            .FirstOrDefaultAsync(pm => pm.ChiusuraId == chiusuraId && pm.PagamentoId == pagamentoId);

        if (esistente != null)
            throw new InvalidOperationException("Pagamento già incluso in questa chiusura");

        // Creazione associazione
        var link = new PagamentoMensileFornitori
        {
            ChiusuraId = chiusuraId,
            PagamentoId = pagamentoId,
            InclusoInChiusura = true
        };

        _dbContext.PagamentiMensiliFornitori.Add(link);
        chiusura.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Modifica una spesa libera esistente. Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    public async Task<SpesaMensileLibera> ModificaSpesaLiberaAsync(
        int spesaId,
        string? descrizione,
        decimal? importo,
        CategoriaSpesa? categoria)
    {
        var spesa = await _dbContext.SpeseMensiliLibere
            .Include(s => s.Chiusura)
            .FirstOrDefaultAsync(s => s.SpesaId == spesaId);

        if (spesa == null)
            throw new InvalidOperationException($"Spesa libera con ID {spesaId} non trovata");

        if (spesa.Chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile modificare spese: la chiusura non è in stato BOZZA");

        if (descrizione != null)
        {
            if (string.IsNullOrWhiteSpace(descrizione))
                throw new ArgumentException("Descrizione non può essere vuota", nameof(descrizione));
            spesa.Descrizione = descrizione.Trim();
        }

        if (importo.HasValue)
        {
            if (importo.Value <= 0)
                throw new ArgumentException("Importo deve essere maggiore di zero", nameof(importo));
            spesa.Importo = importo.Value;
        }

        if (categoria.HasValue)
            spesa.Categoria = categoria.Value;

        spesa.AggiornatoIl = DateTime.UtcNow;
        spesa.Chiusura.AggiornatoIl = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return spesa;
    }

    /// <summary>
    /// Elimina una spesa libera. Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    public async Task<bool> EliminaSpesaLiberaAsync(int spesaId)
    {
        var spesa = await _dbContext.SpeseMensiliLibere
            .Include(s => s.Chiusura)
            .FirstOrDefaultAsync(s => s.SpesaId == spesaId);

        if (spesa == null)
            throw new InvalidOperationException($"Spesa libera con ID {spesaId} non trovata");

        if (spesa.Chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile eliminare spese: la chiusura non è in stato BOZZA");

        spesa.Chiusura.AggiornatoIl = DateTime.UtcNow;
        _dbContext.SpeseMensiliLibere.Remove(spesa);

        await _dbContext.SaveChangesAsync();
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
        var chiusura = await _dbContext.ChiusureMensili
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
        var periodi = await _dbContext.PeriodiProgrammazione
            .OrderBy(p => p.DataInizio)
            .ToListAsync();
        var settings = await _dbContext.BusinessSettings.FirstAsync();
        var operatingDaysGlobali = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;

        var primoGiorno = new DateTime(chiusura.Anno, chiusura.Mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        foreach (var giorno in giorniEsclusi)
        {
            var data = giorno.Data.Date;

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
                var periodo = periodi.FirstOrDefault(p =>
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
        chiusura.AggiornatoIl = DateTime.UtcNow;

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
    public async Task<List<DateTime>> ValidaCompletezzaRegistriAsync(int anno, int mese)
    {
        var primoGiorno = new DateTime(anno, mese, 1);
        var ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        var registriMese = await _dbContext.RegistriCassa
            .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
            .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
            .ToListAsync();

        // Carica i periodi di programmazione per determinare i giorni operativi per-periodo
        var periodi = await _dbContext.PeriodiProgrammazione
            .OrderBy(p => p.DataInizio)
            .ToListAsync();

        List<DateTime> giorniMancanti;

        if (periodi.Count > 0)
        {
            // Usa i periodi di programmazione per determinare i giorni operativi per ogni giorno
            giorniMancanti = ElencoGiorniMancantiPerPeriodo(registriMese, primoGiorno, ultimoGiorno, periodi);
        }
        else
        {
            // Fallback: usa il campo globale OperatingDays di BusinessSettings
            var settings = await _dbContext.BusinessSettings.FirstAsync();
            var operatingDays = JsonSerializer.Deserialize<bool[]>(settings.OperatingDays)!;
            giorniMancanti = ElencoGiorniMancanti(registriMese, primoGiorno, ultimoGiorno, operatingDays);
        }

        // Escludi i giorni non lavorativi configurati
        var giorniNonLavorativi = await _dbContext.GiorniNonLavorativi.ToListAsync();
        if (giorniNonLavorativi.Count > 0)
        {
            giorniMancanti = giorniMancanti.Where(data =>
            {
                var dataOnly = DateOnly.FromDateTime(data);
                return !giorniNonLavorativi.Any(gnl =>
                {
                    if (gnl.Ricorrente)
                    {
                        // Per i ricorrenti, confronta solo mese e giorno
                        return gnl.Data.Month == dataOnly.Month && gnl.Data.Day == dataOnly.Day;
                    }
                    else
                    {
                        // Per i non ricorrenti, confronta la data esatta
                        return gnl.Data == dataOnly;
                    }
                });
            }).ToList();
        }

        return giorniMancanti;
    }

    /// <summary>
    /// Recupera una chiusura con tutte le relazioni necessarie per calcolare le proprietà calcolate.
    /// </summary>
    /// <param name="chiusuraId">ID della chiusura</param>
    /// <returns>Chiusura con relazioni caricate o null se non trovata</returns>
    public async Task<ChiusuraMensile?> GetChiusuraConRelazioniAsync(int chiusuraId)
    {
        return await _dbContext.ChiusureMensili
            .Include(c => c.ChiusaDaUtente)
            .Include(c => c.RegistriInclusi)
                .ThenInclude(r => r.Registro)
            .Include(c => c.SpeseLibere)
            .Include(c => c.PagamentiInclusi)
                .ThenInclude(p => p.Pagamento)
            .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);
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
        var registro = await _dbContext.RegistriCassa
            .FirstOrDefaultAsync(r => r.Id == registroId);

        if (registro == null)
            return false;

        return await DataAppartieneAMeseChiusoAsync(registro.Data);
    }

    /// <summary>
    /// Calcola l'elenco dei giorni mancanti confrontando i registri presenti con i giorni operativi del mese.
    /// Rispetta le impostazioni di OperatingDays: solo i giorni in cui l'attività è aperta vengono considerati.
    /// </summary>
    private List<DateTime> ElencoGiorniMancanti(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno,
        bool[] operatingDays)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (var data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            // Mappa DayOfWeek (.NET: 0=Sunday) a indice array operatingDays (0=Monday)
            int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;

            // Salta i giorni non operativi (es. sabato/domenica se chiusi)
            if (!operatingDays[operatingDayIndex])
                continue;

            if (!giorniPresenti.Contains(data.Date))
            {
                giorniMancanti.Add(data);
            }
        }

        return giorniMancanti;
    }

    /// <summary>
    /// Calcola l'elenco dei giorni mancanti usando i periodi di programmazione.
    /// Per ogni giorno del mese, trova quale periodo lo copre (DataInizio &lt;= giorno
    /// AND (DataFine &gt;= giorno OR DataFine = null)) e usa i GiorniOperativi di quel periodo.
    /// Gestisce correttamente mesi a cavallo tra due periodi.
    /// </summary>
    private List<DateTime> ElencoGiorniMancantiPerPeriodo(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno,
        List<PeriodoProgrammazione> periodi)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (var data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            var dataOnly = DateOnly.FromDateTime(data);

            // Trova il periodo che copre questa data
            var periodo = periodi.FirstOrDefault(p =>
                p.DataInizio <= dataOnly &&
                (p.DataFine == null || p.DataFine >= dataOnly));

            // Se nessun periodo copre questa data, la consideriamo non operativa
            if (periodo == null)
                continue;

            // Parse giorniOperativi del periodo
            bool[]? operatingDays;
            try
            {
                operatingDays = JsonSerializer.Deserialize<bool[]>(periodo.GiorniOperativi);
            }
            catch
            {
                continue; // Se il JSON non è valido, salta il giorno
            }

            if (operatingDays == null || operatingDays.Length != 7)
                continue;

            // Mappa DayOfWeek (.NET: 0=Sunday) a indice array operatingDays (0=Monday)
            int operatingDayIndex = ((int)data.DayOfWeek + 6) % 7;

            // Salta i giorni non operativi secondo questo periodo
            if (!operatingDays[operatingDayIndex])
                continue;

            if (!giorniPresenti.Contains(data.Date))
            {
                giorniMancanti.Add(data);
            }
        }

        return giorniMancanti;
    }
}
