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
            UltimoGiornoLavorativo = ultimoGiorno,
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
        if (giorniMancanti.Any())
        {
            var giorniFormattati = string.Join(", ", giorniMancanti.Select(d => d.ToString("dd/MM/yyyy")));
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
    /// Valida la completezza dei registri cassa per un mese specifico.
    /// Utile per pre-validare prima di creare una chiusura.
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

        return ElencoGiorniMancanti(registriMese, primoGiorno, ultimoGiorno);
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
    /// Calcola l'elenco dei giorni mancanti confrontando i registri presenti con tutti i giorni del mese.
    /// </summary>
    private List<DateTime> ElencoGiorniMancanti(
        List<RegistroCassa> registri,
        DateTime primoGiorno,
        DateTime ultimoGiorno)
    {
        var giorniPresenti = registri.Select(r => r.Data.Date).ToHashSet();
        var giorniMancanti = new List<DateTime>();

        for (var data = primoGiorno; data <= ultimoGiorno; data = data.AddDays(1))
        {
            if (!giorniPresenti.Contains(data.Date))
            {
                giorniMancanti.Add(data);
            }
        }

        return giorniMancanti;
    }
}
