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
        DateTime ultimoGiorno = primoGiorno.AddMonths(1).AddDays(-1);

        // 3. Recupera registri chiusi/riconciliati del mese (senza bloccare la creazione)
        List<RegistroCassa> registriMese = await _dbContext.RegistriCassa
                .Where(r => r.Data >= primoGiorno && r.Data <= ultimoGiorno)
                .Where(r => r.Stato == "CLOSED" || r.Stato == "RECONCILED")
                .ToListAsync();

        // 4. Verifica chiusura già esistente
        ChiusuraMensile? esistente = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.Anno == anno && c.Mese == mese);

        if (esistente != null)
        {
            throw new InvalidOperationException(
                $"Chiusura mensile per {mese:D2}/{anno} già esistente (ID: {esistente.ChiusuraId})"
            );
        }

        // 5-7. Creazione chiusura + link registri + link pagamenti in transazione esplicita:
        // un errore a metà non deve lasciare una chiusura persistita senza link.
        var chiusura = new ChiusuraMensile
        {
            Anno = anno,
            Mese = mese,
            Stato = "BOZZA",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await using IDbContextTransaction transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // 5. Creazione chiusura
            _dbContext.ChiusureMensili.Add(chiusura);
            await _dbContext.SaveChangesAsync();

            // 6. Associazione registri cassa
            foreach (RegistroCassa? registro in registriMese)
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
            List<PagamentoFornitore> pagamentiMese = await _dbContext.PagamentiFornitori
                    .Where(p => p.DataPagamento >= primoGiorno && p.DataPagamento <= ultimoGiorno)
                    .ToListAsync();

            foreach (PagamentoFornitore? pagamento in pagamentiMese)
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
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

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
        CategoriaSpesa categoria,
        DateTime? data = null)
    {
        // Validazione input
        if (string.IsNullOrWhiteSpace(descrizione))
            throw new ArgumentException("Descrizione obbligatoria", nameof(descrizione));

        if (importo <= 0)
            throw new ArgumentException("Importo deve essere maggiore di zero", nameof(importo));

        // Verifica chiusura
        ChiusuraMensile? chiusura = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                $"Impossibile aggiungere spese: la chiusura è in stato '{chiusura.Stato}'. Solo chiusure in stato BOZZA possono essere modificate."
            );
        }

        // Validazione data (se fornita): deve appartenere al mese/anno della chiusura
        ValidaDataNelMese(data, chiusura.Anno, chiusura.Mese);

        // Creazione spesa
        var spesa = new SpesaMensileLibera
        {
            ChiusuraId = chiusuraId,
            Descrizione = descrizione.Trim(),
            Importo = importo,
            Categoria = categoria,
            Data = data?.Date,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.SpeseMensiliLibere.Add(spesa);

        // Aggiorna timestamp chiusura
        chiusura.UpdatedAt = DateTime.UtcNow;

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
        ChiusuraMensile? chiusura = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId);

        if (chiusura == null)
            throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                "Impossibile modificare pagamenti: la chiusura non è in stato BOZZA"
            );
        }

        PagamentoFornitore? pagamento = await _dbContext.PagamentiFornitori
                .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId);

        if (pagamento == null)
            throw new InvalidOperationException($"Pagamento fornitore con ID {pagamentoId} non trovato");

        // Verifica se già associato
        PagamentoMensileFornitori? esistente = await _dbContext.PagamentiMensiliFornitori
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
        chiusura.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Dati per registrare un pagamento fornitore direttamente dalla griglia spese della chiusura.
    /// Il documento (Fattura/DDT) diventa un documento REALE nel registro fornitori; il pagamento
    /// risultante è di ORIGINE-CHIUSURA (<c>RegistroCassaId = null</c>) e viene collegato alla chiusura
    /// tramite la join <see cref="PagamentoMensileFornitori"/>.
    /// </summary>
    /// <param name="FornitoreId">Fornitore del documento.</param>
    /// <param name="TipoDocumento">"FA" (fattura) o "DDT".</param>
    /// <param name="NumeroDocumento">Numero documento; se vuoto viene generato un placeholder SN-*.</param>
    /// <param name="DataPagamento">Data del pagamento/documento; deve appartenere al mese della chiusura.</param>
    /// <param name="Importo">Importo lordo (IVA inclusa), > 0.</param>
    /// <param name="AliquotaIva">Aliquota IVA in percentuale (es. 22); se null usa quella del fornitore o 22.</param>
    /// <param name="MetodoPagamento">Metodo di pagamento (opzionale).</param>
    /// <param name="FatturaIdCollegata">Se valorizzato, collega a una fattura esistente.</param>
    /// <param name="DdtIdCollegato">Se valorizzato, collega a un DDT esistente.</param>
    public sealed record DatiPagamentoChiusura(
        int FornitoreId,
        string TipoDocumento,
        string? NumeroDocumento,
        DateTime DataPagamento,
        decimal Importo,
        decimal? AliquotaIva,
        string? MetodoPagamento,
        int? FatturaIdCollegata,
        int? DdtIdCollegato);

    /// <summary>
    /// Registra un pagamento fornitore (con documento FA/DDT reale nel registro fornitori) dalla
    /// griglia spese della chiusura. Il pagamento è di ORIGINE-CHIUSURA: <c>RegistroCassaId = null</c>,
    /// NON passa da <c>RegistroCassaSyncService</c> e NON crea/tocca alcun <see cref="RegistroCassa"/>.
    /// Viene collegato alla chiusura corrente tramite <see cref="PagamentoMensileFornitori"/>
    /// con <c>InclusoInChiusura = true</c>. Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    /// <exception cref="ArgumentException">Input non valido (importo ≤ 0, fornitore/tipo mancanti).</exception>
    /// <exception cref="InvalidOperationException">Chiusura non trovata, non in BOZZA o data fuori mese.</exception>
    public async Task<PagamentoFornitore> AggiungiPagamentoFornitoreInChiusuraAsync(
        int chiusuraId,
        DatiPagamentoChiusura dati)
    {
        if (dati.Importo <= 0)
            throw new ArgumentException("Importo deve essere maggiore di zero", nameof(dati));

        if (dati.FornitoreId <= 0)
            throw new ArgumentException("Fornitore obbligatorio", nameof(dati));

        string tipo = (dati.TipoDocumento ?? "").Trim().ToUpperInvariant();
        if (tipo != "FA" && tipo != "DDT")
            throw new ArgumentException("Tipo documento non valido: usare 'FA' o 'DDT'", nameof(dati));

        ChiusuraMensile chiusura = await _dbContext.ChiusureMensili
                .FirstOrDefaultAsync(c => c.ChiusuraId == chiusuraId)
            ?? throw new InvalidOperationException($"Chiusura mensile con ID {chiusuraId} non trovata");

        if (chiusura.Stato != "BOZZA")
        {
            throw new InvalidOperationException(
                $"Impossibile aggiungere pagamenti: la chiusura è in stato '{chiusura.Stato}'. Solo chiusure in stato BOZZA possono essere modificate."
            );
        }

        // La data del pagamento deve appartenere al mese/anno della chiusura
        ValidaDataNelMese(dati.DataPagamento, chiusura.Anno, chiusura.Mese);

        await using IDbContextTransaction transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            // 1. Crea/collega il documento reale (FA o DDT). registroCassaCorrente = null:
            //    contesto origine-chiusura, nessun RegistroCassa coinvolto.
            var datiDoc = new DocumentiFornitoreService.DatiDocumento(
                FornitoreId: dati.FornitoreId,
                TipoDocumento: tipo,
                Numero: dati.NumeroDocumento,
                DataDocumento: dati.DataPagamento,
                Importo: dati.Importo,
                AliquotaIva: dati.AliquotaIva,
                FatturaIdCollegata: dati.FatturaIdCollegata,
                DdtIdCollegato: dati.DdtIdCollegato);

            (int? fatturaId, int? ddtId) = await _documentiService.CreaOCollegaAsync(
                datiDoc, dati.DataPagamento, registroCassaCorrente: null,
                fattureConsumate: [], ddtConsumati: []);

            // 2. Crea il PagamentoFornitore di origine-chiusura (RegistroCassaId = null)
            var pagamento = new PagamentoFornitore
            {
                FatturaId = fatturaId,
                DdtId = ddtId,
                DataPagamento = dati.DataPagamento.Date,
                Importo = dati.Importo,
                MetodoPagamento = dati.MetodoPagamento,
                Note = $"Pagamento da chiusura mensile {chiusura.Mese:D2}/{chiusura.Anno}",
                RegistroCassaId = null,
            };
            _dbContext.PagamentiFornitori.Add(pagamento);
            await _dbContext.SaveChangesAsync();

            // 3. Collega il pagamento alla chiusura tramite la join esistente
            _dbContext.PagamentiMensiliFornitori.Add(new PagamentoMensileFornitori
            {
                ChiusuraId = chiusuraId,
                PagamentoId = pagamento.PagamentoId,
                InclusoInChiusura = true,
            });

            // 4. Ricalcola lo stato della fattura collegata (se presente)
            if (pagamento.FatturaId.HasValue)
            {
                FatturaAcquisto? fattura = await _dbContext.FattureAcquisto
                    .Include(f => f.Pagamenti)
                    .FirstOrDefaultAsync(f => f.FatturaId == pagamento.FatturaId.Value);
                if (fattura != null)
                    FatturaAcquistoStatusHelper.RecalculateStato(fattura);
            }

            chiusura.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            // Ricarica con le navigation di documento per il payload GraphQL
            return await _dbContext.PagamentiFornitori
                .Include(p => p.Fattura)
                .Include(p => p.Ddt)
                .FirstAsync(p => p.PagamentoId == pagamento.PagamentoId);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Modifica un pagamento fornitore di origine-chiusura (importo, data, metodo, aliquota).
    /// Permesso solo se la chiusura di appartenenza è in stato BOZZA e il pagamento NON appartiene a un
    /// registro cassa (<c>RegistroCassaId == null</c>). Aggiorna gli importi del documento collegato.
    /// </summary>
    public async Task<PagamentoFornitore> ModificaPagamentoFornitoreInChiusuraAsync(
        int pagamentoId,
        decimal? importo,
        DateTime? dataPagamento,
        string? metodoPagamento,
        decimal? aliquotaIva)
    {
        PagamentoFornitore pagamento = await _dbContext.PagamentiFornitori
                .Include(p => p.Fattura)
                .Include(p => p.Ddt)
                .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId)
            ?? throw new InvalidOperationException($"Pagamento fornitore con ID {pagamentoId} non trovato");

        if (pagamento.RegistroCassaId != null)
        {
            throw new InvalidOperationException(
                "Impossibile modificare da qui: il pagamento appartiene a un registro cassa. Modificarlo dalla registrazione cassa."
            );
        }

        ChiusuraMensile chiusura = await GetChiusuraDelPagamentoAsync(pagamentoId);

        if (chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile modificare pagamenti: la chiusura non è in stato BOZZA");

        if (importo.HasValue)
        {
            if (importo.Value <= 0)
                throw new ArgumentException("Importo deve essere maggiore di zero", nameof(importo));
            pagamento.Importo = importo.Value;
        }

        if (dataPagamento.HasValue)
        {
            ValidaDataNelMese(dataPagamento, chiusura.Anno, chiusura.Mese);
            pagamento.DataPagamento = dataPagamento.Value.Date;
        }

        if (metodoPagamento != null)
            pagamento.MetodoPagamento = metodoPagamento;

        pagamento.UpdatedAt = DateTime.UtcNow;

        // Aggiorna gli importi del documento collegato con lo stesso scorporo IVA della cassa
        if (pagamento.Fattura != null)
        {
            decimal aliquota = aliquotaIva ?? 22m;
            if (aliquotaIva == null)
            {
                Fornitore? fornitore = await _dbContext.Set<Fornitore>().FindAsync(pagamento.Fattura.FornitoreId);
                if (fornitore?.AliquotaIva != null)
                    aliquota = fornitore.AliquotaIva.Value;
            }

            RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
                pagamento.Importo, IvaCalculator.AliquotaDaPercentuale(aliquota));
            pagamento.Fattura.Imponibile = scorporo.Imponibile;
            pagamento.Fattura.ImportoIva = scorporo.Iva;
            pagamento.Fattura.TotaleConIva = scorporo.Totale;
            if (dataPagamento.HasValue)
                pagamento.Fattura.DataFattura = dataPagamento.Value.Date;
            pagamento.Fattura.UpdatedAt = DateTime.UtcNow;

            // Ricalcola lo stato con l'importo pagato aggiornato
            FatturaAcquisto? fatturaConPagamenti = await _dbContext.FattureAcquisto
                .Include(f => f.Pagamenti)
                .FirstOrDefaultAsync(f => f.FatturaId == pagamento.Fattura.FatturaId);
            if (fatturaConPagamenti != null)
                FatturaAcquistoStatusHelper.RecalculateStato(fatturaConPagamenti);
        }
        else if (pagamento.Ddt != null)
        {
            pagamento.Ddt.Importo = pagamento.Importo;
            if (dataPagamento.HasValue)
                pagamento.Ddt.DataDdt = dataPagamento.Value.Date;
            pagamento.Ddt.UpdatedAt = DateTime.UtcNow;
        }

        chiusura.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return pagamento;
    }

    /// <summary>
    /// Elimina un pagamento fornitore di origine-chiusura e il relativo link con la chiusura.
    /// Permesso solo se la chiusura è in stato BOZZA e il pagamento NON appartiene a un registro cassa.
    /// Il documento FA/DDT NON viene eliminato (coerente con il flusso cassa): ne viene solo ricalcolato lo stato.
    /// </summary>
    public async Task<bool> EliminaPagamentoFornitoreInChiusuraAsync(int pagamentoId)
    {
        PagamentoFornitore pagamento = await _dbContext.PagamentiFornitori
                .FirstOrDefaultAsync(p => p.PagamentoId == pagamentoId)
            ?? throw new InvalidOperationException($"Pagamento fornitore con ID {pagamentoId} non trovato");

        if (pagamento.RegistroCassaId != null)
        {
            throw new InvalidOperationException(
                "Impossibile eliminare da qui: il pagamento appartiene a un registro cassa. Eliminarlo dalla registrazione cassa."
            );
        }

        ChiusuraMensile chiusura = await GetChiusuraDelPagamentoAsync(pagamentoId);

        if (chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile eliminare pagamenti: la chiusura non è in stato BOZZA");

        int? fatturaId = pagamento.FatturaId;

        // Rimuovi PRIMA i link della join (FK Restrict), poi il pagamento
        List<PagamentoMensileFornitori> links = await _dbContext.PagamentiMensiliFornitori
            .Where(pm => pm.PagamentoId == pagamentoId)
            .ToListAsync();
        _dbContext.PagamentiMensiliFornitori.RemoveRange(links);
        _dbContext.PagamentiFornitori.Remove(pagamento);
        await _dbContext.SaveChangesAsync();

        // Ricalcola lo stato della fattura collegata (documento NON eliminato)
        if (fatturaId.HasValue)
        {
            FatturaAcquisto? fattura = await _dbContext.FattureAcquisto
                .Include(f => f.Pagamenti)
                .FirstOrDefaultAsync(f => f.FatturaId == fatturaId.Value);
            if (fattura != null)
            {
                FatturaAcquistoStatusHelper.RecalculateStato(fattura);
                await _dbContext.SaveChangesAsync();
            }
        }

        chiusura.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return true;
    }

    /// <summary>
    /// Recupera la chiusura a cui è collegato un pagamento tramite la join
    /// <see cref="PagamentoMensileFornitori"/>. Un pagamento di origine-chiusura è collegato a
    /// esattamente una chiusura.
    /// </summary>
    private async Task<ChiusuraMensile> GetChiusuraDelPagamentoAsync(int pagamentoId)
    {
        PagamentoMensileFornitori? link = await _dbContext.PagamentiMensiliFornitori
            .Include(pm => pm.Chiusura)
            .FirstOrDefaultAsync(pm => pm.PagamentoId == pagamentoId);

        return link?.Chiusura
            ?? throw new InvalidOperationException(
                $"Il pagamento con ID {pagamentoId} non è collegato ad alcuna chiusura mensile");
    }

    /// <summary>
    /// Modifica una spesa libera esistente. Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    public async Task<SpesaMensileLibera> ModificaSpesaLiberaAsync(
        int spesaId,
        string? descrizione,
        decimal? importo,
        CategoriaSpesa? categoria,
        DateTime? data = null)
    {
        SpesaMensileLibera? spesa = await _dbContext.SpeseMensiliLibere
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

        if (data.HasValue)
        {
            // Validazione data: deve appartenere al mese/anno della chiusura di appartenenza
            ValidaDataNelMese(data, spesa.Chiusura.Anno, spesa.Chiusura.Mese);
            spesa.Data = data.Value.Date;
        }

        spesa.UpdatedAt = DateTime.UtcNow;
        spesa.Chiusura.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        return spesa;
    }

    /// <summary>
    /// Elimina una spesa libera. Permesso solo se la chiusura è in stato BOZZA.
    /// </summary>
    public async Task<bool> EliminaSpesaLiberaAsync(int spesaId)
    {
        SpesaMensileLibera? spesa = await _dbContext.SpeseMensiliLibere
                .Include(s => s.Chiusura)
                .FirstOrDefaultAsync(s => s.SpesaId == spesaId);

        if (spesa == null)
            throw new InvalidOperationException($"Spesa libera con ID {spesaId} non trovata");

        if (spesa.Chiusura.Stato != "BOZZA")
            throw new InvalidOperationException("Impossibile eliminare spese: la chiusura non è in stato BOZZA");

        spesa.Chiusura.UpdatedAt = DateTime.UtcNow;
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
    /// (a) registri cassa CLOSED/RECONCILED del mese NON inclusi in RegistriInclusi;
    /// (b) pagamenti fornitori con DataPagamento nel mese NON inclusi in PagamentiInclusi.
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

        // (b) Pagamenti fornitori del mese non inclusi tra i pagamenti della chiusura
        HashSet<int> pagamentiInclusiIds = chiusura.PagamentiInclusi
            .Select(p => p.PagamentoId)
            .ToHashSet();

        List<PagamentoFornitore> pagamentiMese = await _dbContext.PagamentiFornitori
            .Where(p => p.DataPagamento >= primoGiorno && p.DataPagamento <= ultimoGiorno)
            .ToListAsync();

        var pagamentiMancanti = pagamentiMese
            .Where(p => !pagamentiInclusiIds.Contains(p.PagamentoId))
            .ToList();

        if (pagamentiMancanti.Count > 0)
        {
            decimal totale = pagamentiMancanti.Sum(p => p.Importo);
            avvisi.Add(
                $"Attenzione: {pagamentiMancanti.Count} pagamento/i fornitore del mese non incluso/i nella chiusura (totale € {totale:N2})."
            );
        }

        return avvisi;
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
        RegistroCassa? registro = await _dbContext.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == registroId);

        if (registro == null)
            return false;

        return await DataAppartieneAMeseChiusoAsync(registro.Data);
    }

}
