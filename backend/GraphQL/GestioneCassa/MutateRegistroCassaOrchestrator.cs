using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Common;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.GestioneCassa;

public class MutateRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;
    private readonly ILogger<MutateRegistroCassaOrchestrator> _logger;

    public MutateRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus,
        ILogger<MutateRegistroCassaOrchestrator> logger)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<RegistroCassa> ExecuteAsync(RegistroCassaInput input)
    {
        AppDbContext db = _unitOfWork.Context;

        // === Guards ===
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);
        await GestioneCassaGuards.GuardGiornoOperativoConPeriodi(db, input.Data);

        RegistroCassa registroCassa;

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            // === Upsert registro base ===
            registroCassa = await UpsertRegistroBase(db, input);

            // === Conteggi moneta (apertura + chiusura) ===
            List<DenominazioneMoneta> denominazioni = await db.DenominazioniMoneta.ToListAsync();
            decimal totaleApertura = AggiungiConteggi(registroCassa, denominazioni, input.ConteggiApertura, isApertura: true);
            decimal totaleChiusura = AggiungiConteggi(registroCassa, denominazioni, input.ConteggiChiusura, isApertura: false);
            registroCassa.TotaleApertura = totaleApertura;
            registroCassa.TotaleChiusura = totaleChiusura;

            // === Spese giornaliere ===
            decimal totaleSpese = AggiungiSpese(registroCassa, input.Spese);

            // === Pagamenti fornitori (algoritmo 7-step) ===
            // Save per garantire che registroCassa.Id sia disponibile per registri nuovi
            await _unitOfWork.SaveChangesAsync();
            await ProcessaPagamentiFornitori(db, registroCassa, input);

            // === Calcoli finali ===
            BusinessSettings settings = await db.BusinessSettings.FirstAsync();
            CalcolaTotali(registroCassa, totaleSpese);

            // VenditeContanti/TotaleVendite/ImportoIva + breakdown IVA per aliquota:
            // punto di calcolo unico condiviso con le mutation Vendite
            await BreakdownIvaApplier.ApplicaAsync(db, registroCassa, settings.VatRate, _logger);

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }

        // Evento pubblicato DOPO il commit della transazione
        _eventBus.Publish(new RegistroCassaUpdatedEvent
        {
            RegistroCassaId = registroCassa.Id,
            Data = registroCassa.Data,
            Stato = registroCassa.Stato ?? string.Empty,
            TotaleVendite = registroCassa.TotaleVendite,
            TotaleApertura = registroCassa.TotaleApertura,
            TotaleChiusura = registroCassa.TotaleChiusura,
            Azione = "UPDATED"
        });

        // Reload per DataLoader dei subfield
        return (await db.RegistriCassa.FirstOrDefaultAsync(r => r.Id == registroCassa.Id))!;
    }

    // ───────────────────────────────────────────────
    // Metodi privati
    // ───────────────────────────────────────────────

    private static async Task<RegistroCassa> UpsertRegistroBase(
        DataAccess.AppDbContext db, RegistroCassaInput input)
    {
        RegistroCassa? registroCassa = await db.RegistriCassa
                .Include(r => r.ConteggiMoneta)
                .Include(r => r.SpeseCassa)
                .Include(r => r.BreakdownIva)
                .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);

        if (registroCassa != null)
        {
            db.ConteggiMoneta.RemoveRange(registroCassa.ConteggiMoneta);
            db.SpeseCassa.RemoveRange(registroCassa.SpeseCassa);
            db.RegistriCassaIva.RemoveRange(registroCassa.BreakdownIva);
        }
        else
        {
            registroCassa = new RegistroCassa();
            db.RegistriCassa.Add(registroCassa);
        }

        registroCassa.Data = input.Data;
        registroCassa.UtenteId = input.UtenteId;
        registroCassa.IncassoContanteTracciato = input.IncassoContanteTracciato;
        registroCassa.IncassiElettronici = input.IncassiElettronici;
        registroCassa.IncassiFattura = input.IncassiFattura;
        registroCassa.SpeseFornitori = input.SpeseFornitori;
        registroCassa.SpeseGiornaliere = input.SpeseGiornaliere;
        registroCassa.Note = input.Note;
        registroCassa.Stato = input.Stato;
        registroCassa.UpdatedAt = DateTime.UtcNow;

        return registroCassa;
    }

    private static decimal AggiungiConteggi(
        RegistroCassa registroCassa,
        List<DenominazioneMoneta> denominazioni,
        List<ConteggioMonetaInput> conteggiInput,
        bool isApertura)
    {
        decimal totale = 0;
        foreach (ConteggioMonetaInput conteggioInput in conteggiInput)
        {
            DenominazioneMoneta? denominazione = denominazioni.FirstOrDefault(d => d.Id == conteggioInput.DenominazioneMonetaId);
            if (denominazione != null)
            {
                decimal subtotale = conteggioInput.Quantita * denominazione.Valore;
                totale += subtotale;

                registroCassa.ConteggiMoneta.Add(new ConteggioMoneta
                {
                    DenominazioneMonetaId = conteggioInput.DenominazioneMonetaId,
                    Quantita = conteggioInput.Quantita,
                    Totale = subtotale,
                    IsApertura = isApertura
                });
            }
        }
        return totale;
    }

    private static decimal AggiungiSpese(RegistroCassa registroCassa, List<SpesaCassaInput> speseInput)
    {
        decimal totaleSpese = 0;
        foreach (SpesaCassaInput spesaInput in speseInput)
        {
            registroCassa.SpeseCassa.Add(new SpesaCassa
            {
                Descrizione = spesaInput.Descrizione,
                Importo = spesaInput.Importo
            });
            totaleSpese += spesaInput.Importo;
        }
        return totaleSpese;
    }

    private static async Task ProcessaPagamentiFornitori(
        DataAccess.AppDbContext db,
        RegistroCassa registroCassa,
        RegistroCassaInput input)
    {
        List<PagamentoFornitoreRegistroInput> pagamentiInput = input.PagamentiFornitori;

        // STEP 1: Load existing payments for this register
        List<PagamentoFornitore> existingPayments = await db.PagamentiFornitori
                .Where(p => p.RegistroCassaId == registroCassa.Id)
                .ToListAsync();

        // STEP 2: Build maps
        var inputById = pagamentiInput
            .Where(p => p.PagamentoId != null)
            .ToDictionary(p => p.PagamentoId!.Value);
        var inputNew = pagamentiInput
            .Where(p => p.PagamentoId == null)
            .ToList();
        var inputIds = inputById.Keys.ToHashSet();

        // STEP 3: Determine operations
        var toDelete = existingPayments
            .Where(p => !inputIds.Contains(p.PagamentoId))
            .ToList();
        var toUpdate = existingPayments
            .Where(p => inputIds.Contains(p.PagamentoId))
            .ToList();

        // STEP 4: DELETE removed payments + update invoice status
        await DeletePagamenti(db, toDelete);

        // STEP 5: UPDATE existing payments
        await UpdatePagamentiEsistenti(db, toUpdate, inputById);

        // STEP 6: CREATE new payments
        await CreaPagamentiNuovi(db, registroCassa, inputNew, input.Data);

        // STEP 7: SaveChanges and recalculate SpeseFornitori
        await db.SaveChangesAsync();

        var totalePagamentiFornitori = await db.PagamentiFornitori
            .Where(p => p.RegistroCassaId == registroCassa.Id)
            .SumAsync(p => p.Importo);

        registroCassa.SpeseFornitori = totalePagamentiFornitori;
    }

    private static async Task DeletePagamenti(
        DataAccess.AppDbContext db,
        List<PagamentoFornitore> toDelete)
    {
        if (toDelete.Count == 0) return;

        var affectedFatturaIds = toDelete
            .Where(p => p.FatturaId.HasValue)
            .Select(p => p.FatturaId!.Value)
            .Distinct()
            .ToList();

        db.PagamentiFornitori.RemoveRange(toDelete);
        await db.SaveChangesAsync();

        // Aggiorna stato fatture collegate (i documenti NON vengono cancellati)
        if (affectedFatturaIds.Count > 0)
        {
            List<FatturaAcquisto> fatture = await db.FattureAcquisto
                      .Include(f => f.Pagamenti)
                      .Where(f => affectedFatturaIds.Contains(f.FatturaId))
                      .ToListAsync();

            foreach (FatturaAcquisto? fattura in fatture)
            {
                FatturaAcquistoStatusHelper.RecalculateStato(fattura);
            }
            await db.SaveChangesAsync();
        }
    }

    private static async Task UpdatePagamentiEsistenti(
        DataAccess.AppDbContext db,
        List<PagamentoFornitore> toUpdate,
        Dictionary<int, PagamentoFornitoreRegistroInput> inputById)
    {
        foreach (PagamentoFornitore existing in toUpdate)
        {
            PagamentoFornitoreRegistroInput inp = inputById[existing.PagamentoId];
            existing.Importo = inp.Importo;
            existing.MetodoPagamento = inp.MetodoPagamento;
            existing.UpdatedAt = DateTime.UtcNow;

            if (existing.FatturaId.HasValue)
            {
                FatturaAcquisto? linkedFattura = await db.FattureAcquisto.FindAsync(existing.FatturaId.Value);
                if (linkedFattura != null)
                {
                    decimal aliquota = inp.AliquotaIva ?? 22m;
                    if (inp.AliquotaIva == null)
                    {
                        Fornitore? fornitore = await db.Set<Fornitore>().FindAsync(inp.FornitoreId);
                        if (fornitore?.AliquotaIva != null)
                            aliquota = fornitore.AliquotaIva.Value;
                    }

                    RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
                        inp.Importo, IvaCalculator.AliquotaDaPercentuale(aliquota));
                    linkedFattura.Imponibile = scorporo.Imponibile;
                    linkedFattura.ImportoIva = scorporo.Iva;
                    linkedFattura.TotaleConIva = scorporo.Totale;
                    linkedFattura.UpdatedAt = DateTime.UtcNow;
                }
            }
        }
    }

    private static async Task CreaPagamentiNuovi(
        DataAccess.AppDbContext db,
        RegistroCassa registroCassa,
        List<PagamentoFornitoreRegistroInput> inputNew,
        DateTime dataRegistro)
    {
        // Documenti riusati/creati in QUESTA richiesta: righe multiple senza numero
        // non devono consumare lo stesso documento placeholder.
        HashSet<int> fattureConsumate = [];
        HashSet<int> ddtConsumati = [];

        foreach (PagamentoFornitoreRegistroInput pagInput in inputNew)
        {
            int? fatturaId = null;
            int? ddtId = null;

            if (pagInput.FatturaId != null)
            {
                fatturaId = pagInput.FatturaId;
            }
            else if (pagInput.TipoDocumento == "FA")
            {
                fatturaId = await CreaFatturaAcquisto(db, pagInput, dataRegistro, registroCassa.Id, fattureConsumate);
            }
            else if (pagInput.DdtId != null)
            {
                ddtId = pagInput.DdtId;
            }
            else
            {
                ddtId = await CreaDocumentoTrasporto(db, pagInput, dataRegistro, registroCassa.Id, ddtConsumati);
            }

            db.PagamentiFornitori.Add(new PagamentoFornitore
            {
                FatturaId = fatturaId,
                DdtId = ddtId,
                DataPagamento = dataRegistro,
                Importo = pagInput.Importo,
                MetodoPagamento = pagInput.MetodoPagamento,
                Note = $"Pagamento da registro cassa del {dataRegistro:dd/MM/yyyy}",
                RegistroCassaId = registroCassa.Id,
            });
        }
    }

    private static async Task<int> CreaFatturaAcquisto(
        DataAccess.AppDbContext db,
        PagamentoFornitoreRegistroInput pagInput,
        DateTime dataRegistro,
        int registroCassaId,
        HashSet<int> fattureConsumate)
    {
        string numeroFattura = (pagInput.NumeroFattura ?? "").Trim();
        FatturaAcquisto? existing = null;

        if (numeroFattura.Length > 0)
        {
            // Lookup sulla stessa chiave dell'indice UNIQUE (FornitoreId, NumeroFattura)
            existing = await db.FattureAcquisto
                .Include(f => f.Pagamenti)
                .FirstOrDefaultAsync(f =>
                    f.FornitoreId == pagInput.FornitoreId &&
                    f.NumeroFattura == numeroFattura);

            // Pagamenti di un ALTRO registro → vera doppia registrazione (errore bloccante).
            // Pagamenti solo del registro corrente (riscrittura) o nessun pagamento → riuso.
            if (existing != null && existing.Pagamenti.Any(p => p.RegistroCassaId != registroCassaId))
            {
                throw new ExecutionError(
                    $"La fattura n. {numeroFattura} del fornitore (Id: {pagInput.FornitoreId}) " +
                    $"è già registrata in un altro registro cassa (FatturaId: {existing.FatturaId}). " +
                    "Non è possibile registrare due volte la stessa fattura.");
            }
        }
        else
        {
            // Numero vuoto → normalizzazione con placeholder deterministico SN-{yyyyMMdd}-{seq}
            string prefix = PlaceholderPrefix(dataRegistro);
            List<FatturaAcquisto> candidate = await db.FattureAcquisto
                .Include(f => f.Pagamenti)
                .Where(f => f.FornitoreId == pagInput.FornitoreId && f.NumeroFattura.StartsWith(prefix))
                .ToListAsync();

            // Riusa la prima fattura placeholder "libera": non consumata da un'altra riga
            // della stessa richiesta e senza pagamenti di registri diversi dal corrente.
            existing = candidate
                .Where(f => !fattureConsumate.Contains(f.FatturaId))
                .FirstOrDefault(f => f.Pagamenti.All(p => p.RegistroCassaId == registroCassaId));

            if (existing == null)
            {
                numeroFattura = ProssimoNumeroPlaceholder(prefix, candidate.Select(f => f.NumeroFattura));
            }
        }

        decimal aliquota = pagInput.AliquotaIva ?? 22m;
        if (pagInput.AliquotaIva == null)
        {
            Fornitore? fornitore = await db.Set<Fornitore>().FindAsync(pagInput.FornitoreId);
            if (fornitore?.AliquotaIva != null)
                aliquota = fornitore.AliquotaIva.Value;
        }

        RisultatoIva scorporo = IvaCalculator.ScorporaDaLordo(
            pagInput.Importo, IvaCalculator.AliquotaDaPercentuale(aliquota));

        if (existing != null)
        {
            // Riuso: aggiorna gli importi con lo stesso scorporo di UpdatePagamentiEsistenti
            existing.DataFattura = pagInput.DataFattura ?? dataRegistro;
            existing.Imponibile = scorporo.Imponibile;
            existing.ImportoIva = scorporo.Iva;
            existing.TotaleConIva = scorporo.Totale;
            existing.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            fattureConsumate.Add(existing.FatturaId);
            return existing.FatturaId;
        }

        var fattura = new FatturaAcquisto
        {
            FornitoreId = pagInput.FornitoreId,
            NumeroFattura = numeroFattura,
            DataFattura = pagInput.DataFattura ?? dataRegistro,
            Imponibile = scorporo.Imponibile,
            ImportoIva = scorporo.Iva,
            TotaleConIva = scorporo.Totale,
            Stato = "PAGATA",
        };
        db.FattureAcquisto.Add(fattura);
        await db.SaveChangesAsync();
        fattureConsumate.Add(fattura.FatturaId);
        return fattura.FatturaId;
    }

    private static async Task<int> CreaDocumentoTrasporto(
        DataAccess.AppDbContext db,
        PagamentoFornitoreRegistroInput pagInput,
        DateTime dataRegistro,
        int registroCassaId,
        HashSet<int> ddtConsumati)
    {
        string numero = (pagInput.NumeroDdt ?? "").Trim();

        if (numero.Length > 0)
        {
            // Lookup sulla stessa chiave dell'indice UNIQUE (FornitoreId, NumeroDdt)
            DocumentoTrasporto? existing = await db.DocumentiTrasporto
                .FirstOrDefaultAsync(d =>
                    d.FornitoreId == pagInput.FornitoreId &&
                    d.NumeroDdt == numero);

            if (existing != null)
            {
                existing.DataDdt = pagInput.DataDdt ?? dataRegistro;
                existing.Importo = pagInput.Importo;
                existing.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
                ddtConsumati.Add(existing.DdtId);
                return existing.DdtId;
            }
        }
        else
        {
            // Numero vuoto → normalizzazione con placeholder deterministico SN-{yyyyMMdd}-{seq}
            string prefix = PlaceholderPrefix(dataRegistro);
            List<DocumentoTrasporto> candidati = await db.DocumentiTrasporto
                .Include(d => d.Pagamenti)
                .Where(d => d.FornitoreId == pagInput.FornitoreId && d.NumeroDdt.StartsWith(prefix))
                .ToListAsync();

            // Riusa il primo DDT placeholder "libero": non consumato da un'altra riga
            // della stessa richiesta e senza pagamenti di registri diversi dal corrente.
            DocumentoTrasporto? libero = candidati
                .Where(d => !ddtConsumati.Contains(d.DdtId))
                .FirstOrDefault(d => d.Pagamenti.All(p => p.RegistroCassaId == registroCassaId));

            if (libero != null)
            {
                libero.DataDdt = pagInput.DataDdt ?? dataRegistro;
                libero.Importo = pagInput.Importo;
                libero.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
                ddtConsumati.Add(libero.DdtId);
                return libero.DdtId;
            }

            numero = ProssimoNumeroPlaceholder(prefix, candidati.Select(d => d.NumeroDdt));
        }

        var ddt = new DocumentoTrasporto
        {
            FornitoreId = pagInput.FornitoreId,
            NumeroDdt = numero,
            DataDdt = pagInput.DataDdt ?? dataRegistro,
            Importo = pagInput.Importo,
            FatturaId = null,
        };
        db.DocumentiTrasporto.Add(ddt);
        await db.SaveChangesAsync();
        ddtConsumati.Add(ddt.DdtId);
        return ddt.DdtId;
    }

    /// <summary>
    /// Prefisso del numero placeholder per documenti senza numero: "SN-{yyyyMMdd}-"
    /// (SN = senza numero, data del registro cassa).
    /// </summary>
    private static string PlaceholderPrefix(DateTime dataRegistro)
        => $"SN-{dataRegistro:yyyyMMdd}-";

    /// <summary>
    /// Primo numero placeholder libero per il prefisso dato: "SN-{yyyyMMdd}-{seq}"
    /// con seq ≥ 1 non ancora usato tra i numeri esistenti (lunghezza ≤ 50, MaxLength dei campi numero).
    /// </summary>
    private static string ProssimoNumeroPlaceholder(string prefix, IEnumerable<string> numeriEsistenti)
    {
        HashSet<int> occupati = numeriEsistenti
            .Select(n => int.TryParse(n[prefix.Length..], out int seq) ? seq : 0)
            .Where(seq => seq > 0)
            .ToHashSet();

        int prossimo = Enumerable.Range(1, occupati.Count + 1).First(seq => !occupati.Contains(seq));
        return $"{prefix}{prossimo}";
    }

    // VenditeContanti, TotaleVendite, ImportoIva e breakdown IVA sono calcolati da
    // BreakdownIvaApplier (VenditeContanti = Σ Vendite persistite, non più azzerato).
    private static void CalcolaTotali(RegistroCassa registroCassa, decimal totaleSpese)
    {
        registroCassa.SpeseGiornaliere = totaleSpese;

        registroCassa.ContanteAtteso = registroCassa.IncassoContanteTracciato
            - registroCassa.SpeseFornitori
            - registroCassa.SpeseGiornaliere;

        decimal incassoGiornaliero = registroCassa.TotaleChiusura - registroCassa.TotaleApertura;
        registroCassa.Differenza = incassoGiornaliero - registroCassa.ContanteAtteso;
        registroCassa.ContanteNetto = incassoGiornaliero;
    }
}
