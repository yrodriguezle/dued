using Microsoft.EntityFrameworkCore;

using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Subscriptions.Types;

namespace duedgusto.GraphQL.GestioneCassa;

public class MutateRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly IEventBus _eventBus;

    public MutateRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        IEventBus eventBus)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _eventBus = eventBus;
    }

    public async Task<RegistroCassa> ExecuteAsync(RegistroCassaInput input)
    {
        var db = _unitOfWork.Context;

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
            var denominazioni = await db.DenominazioniMoneta.ToListAsync();
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
            var settings = await db.BusinessSettings.FirstAsync();
            CalcolaTotali(registroCassa, totaleSpese, settings.VatRate);

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
        var registroCassa = await db.RegistriCassa
            .Include(r => r.ConteggiMoneta)
            .Include(r => r.SpeseCassa)
            .FirstOrDefaultAsync(r => r.Data.Date == input.Data.Date);

        if (registroCassa != null)
        {
            db.ConteggiMoneta.RemoveRange(registroCassa.ConteggiMoneta);
            db.SpeseCassa.RemoveRange(registroCassa.SpeseCassa);
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
        registroCassa.AggiornatoIl = DateTime.UtcNow;

        return registroCassa;
    }

    private static decimal AggiungiConteggi(
        RegistroCassa registroCassa,
        List<DenominazioneMoneta> denominazioni,
        List<ConteggioMonetaInput> conteggiInput,
        bool isApertura)
    {
        decimal totale = 0;
        foreach (var conteggioInput in conteggiInput)
        {
            var denominazione = denominazioni.FirstOrDefault(d => d.Id == conteggioInput.DenominazioneMonetaId);
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
        foreach (var spesaInput in speseInput)
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
        var pagamentiInput = input.PagamentiFornitori;

        // STEP 1: Load existing payments for this register
        var existingPayments = await db.PagamentiFornitori
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

        // STEP 4: DELETE removed payments + cleanup orphan documents
        await DeletePagamentiAndOrphans(db, toDelete);

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

    private static async Task DeletePagamentiAndOrphans(
        DataAccess.AppDbContext db,
        List<PagamentoFornitore> toDelete)
    {
        var orphanFatturaIds = toDelete
            .Where(p => p.FatturaId.HasValue)
            .Select(p => p.FatturaId!.Value)
            .ToList();
        var orphanDdtIds = toDelete
            .Where(p => p.DdtId.HasValue)
            .Select(p => p.DdtId!.Value)
            .ToList();

        db.PagamentiFornitori.RemoveRange(toDelete);

        if (toDelete.Count > 0)
            await db.SaveChangesAsync();

        if (orphanFatturaIds.Count > 0)
        {
            var orphanFatture = await db.FattureAcquisto
                .Where(f => orphanFatturaIds.Contains(f.FatturaId))
                .Where(f => !db.PagamentiFornitori.Any(p => p.FatturaId == f.FatturaId))
                .ToListAsync();
            db.FattureAcquisto.RemoveRange(orphanFatture);
        }
        if (orphanDdtIds.Count > 0)
        {
            var orphanDdts = await db.DocumentiTrasporto
                .Where(d => orphanDdtIds.Contains(d.DdtId) && d.FatturaId == null)
                .Where(d => !db.PagamentiFornitori.Any(p => p.DdtId == d.DdtId))
                .ToListAsync();
            db.DocumentiTrasporto.RemoveRange(orphanDdts);
        }

        if (orphanFatturaIds.Count > 0 || orphanDdtIds.Count > 0)
            await db.SaveChangesAsync();
    }

    private static async Task UpdatePagamentiEsistenti(
        DataAccess.AppDbContext db,
        List<PagamentoFornitore> toUpdate,
        Dictionary<int, PagamentoFornitoreRegistroInput> inputById)
    {
        foreach (var existing in toUpdate)
        {
            var inp = inputById[existing.PagamentoId];
            existing.Importo = inp.Importo;
            existing.MetodoPagamento = inp.MetodoPagamento;
            existing.AggiornatoIl = DateTime.UtcNow;

            if (existing.FatturaId.HasValue)
            {
                var linkedFattura = await db.FattureAcquisto.FindAsync(existing.FatturaId.Value);
                if (linkedFattura != null)
                {
                    decimal aliquota = inp.AliquotaIva ?? 22m;
                    if (inp.AliquotaIva == null)
                    {
                        var fornitore = await db.Set<Fornitore>().FindAsync(inp.FornitoreId);
                        if (fornitore?.AliquotaIva != null)
                            aliquota = fornitore.AliquotaIva.Value;
                    }

                    decimal totaleConIva = inp.Importo;
                    decimal imponibile = Math.Round(totaleConIva / (1 + aliquota / 100m), 2);
                    linkedFattura.Imponibile = imponibile;
                    linkedFattura.ImportoIva = totaleConIva - imponibile;
                    linkedFattura.TotaleConIva = totaleConIva;
                    linkedFattura.AggiornatoIl = DateTime.UtcNow;
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
        foreach (var pagInput in inputNew)
        {
            int? fatturaId = null;
            int? ddtId = null;

            if (pagInput.FatturaId != null)
            {
                fatturaId = pagInput.FatturaId;
            }
            else if (pagInput.TipoDocumento == "FA")
            {
                fatturaId = await CreaFatturaAcquisto(db, pagInput, dataRegistro);
            }
            else if (pagInput.DdtId != null)
            {
                ddtId = pagInput.DdtId;
            }
            else
            {
                ddtId = await CreaDocumentoTrasporto(db, pagInput, dataRegistro);
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
        DateTime dataRegistro)
    {
        decimal aliquota = pagInput.AliquotaIva ?? 22m;
        if (pagInput.AliquotaIva == null)
        {
            var fornitore = await db.Set<Fornitore>().FindAsync(pagInput.FornitoreId);
            if (fornitore?.AliquotaIva != null)
                aliquota = fornitore.AliquotaIva.Value;
        }

        decimal totaleConIva = pagInput.Importo;
        decimal imponibile = Math.Round(totaleConIva / (1 + aliquota / 100m), 2);
        decimal importoIva = totaleConIva - imponibile;

        var fattura = new FatturaAcquisto
        {
            FornitoreId = pagInput.FornitoreId,
            NumeroFattura = pagInput.NumeroFattura ?? "",
            DataFattura = pagInput.DataFattura ?? dataRegistro,
            Imponibile = imponibile,
            ImportoIva = importoIva,
            TotaleConIva = totaleConIva,
            Stato = "PAGATA",
        };
        db.FattureAcquisto.Add(fattura);
        await db.SaveChangesAsync();
        return fattura.FatturaId;
    }

    private static async Task<int> CreaDocumentoTrasporto(
        DataAccess.AppDbContext db,
        PagamentoFornitoreRegistroInput pagInput,
        DateTime dataRegistro)
    {
        var ddt = new DocumentoTrasporto
        {
            FornitoreId = pagInput.FornitoreId,
            NumeroDdt = pagInput.NumeroDdt,
            DataDdt = pagInput.DataDdt ?? dataRegistro,
            Importo = pagInput.Importo,
            FatturaId = null,
        };
        db.DocumentiTrasporto.Add(ddt);
        await db.SaveChangesAsync();
        return ddt.DdtId;
    }

    private static void CalcolaTotali(RegistroCassa registroCassa, decimal totaleSpese, decimal aliquotaIva)
    {
        registroCassa.SpeseGiornaliere = totaleSpese;

        registroCassa.VenditeContanti = 0;
        registroCassa.TotaleVendite = registroCassa.VenditeContanti
            + registroCassa.IncassiElettronici
            + registroCassa.IncassoContanteTracciato
            + registroCassa.IncassiFattura;

        registroCassa.ContanteAtteso = registroCassa.VenditeContanti
            - registroCassa.SpeseFornitori
            - registroCassa.SpeseGiornaliere;

        decimal incassoGiornaliero = registroCassa.TotaleChiusura - registroCassa.TotaleApertura;
        registroCassa.Differenza = incassoGiornaliero - registroCassa.ContanteAtteso;
        registroCassa.ContanteNetto = incassoGiornaliero;

        // Calcolo IVA con scorporo (prezzi IVA inclusa, normativa italiana)
        registroCassa.ImportoIva = Math.Round(
            registroCassa.TotaleVendite * (aliquotaIva / (1 + aliquotaIva)), 2);
    }
}
