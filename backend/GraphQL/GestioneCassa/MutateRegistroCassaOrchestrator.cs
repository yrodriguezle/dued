using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Common;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;
using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Subscriptions.Types;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.GestioneCassa;

public class MutateRegistroCassaOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;
    private readonly DocumentiFornitoreService _documentiService;
    private readonly IEventBus _eventBus;
    private readonly ILogger<MutateRegistroCassaOrchestrator> _logger;

    public MutateRegistroCassaOrchestrator(
        IUnitOfWork unitOfWork,
        ChiusuraMensileService chiusuraService,
        DocumentiFornitoreService documentiService,
        IEventBus eventBus,
        ILogger<MutateRegistroCassaOrchestrator> logger)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
        _documentiService = documentiService;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task<RegistroCassa> ExecuteAsync(RegistroCassaInput input)
    {
        AppDbContext db = _unitOfWork.Context;

        // === Guards ===
        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, input.Data);
        await GestioneCassaGuards.GuardGiornoOperativoConPeriodi(db, input.Data);

        RegistroCassa registroCassa = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // === Upsert registro base ===
            RegistroCassa registro = await UpsertRegistroBase(db, input);

            // === Conteggi moneta (apertura + chiusura) ===
            List<DenominazioneMoneta> denominazioni = await db.DenominazioniMoneta.ToListAsync();
            decimal totaleApertura = AggiungiConteggi(registro, denominazioni, input.ConteggiApertura, isApertura: true);
            decimal totaleChiusura = AggiungiConteggi(registro, denominazioni, input.ConteggiChiusura, isApertura: false);
            registro.TotaleApertura = totaleApertura;
            registro.TotaleChiusura = totaleChiusura;

            // === Spese giornaliere ===
            decimal totaleSpese = AggiungiSpese(registro, input.Spese);

            // === Pagamenti fornitori (algoritmo 7-step) ===
            // Save per garantire che registro.Id sia disponibile per registri nuovi
            await _unitOfWork.SaveChangesAsync();
            await ProcessaPagamentiFornitori(db, registro, input);

            // === Calcoli finali ===
            BusinessSettings settings = await db.BusinessSettings.FirstAsync();
            CalcolaTotali(registro, totaleSpese);

            // VenditeContanti/TotaleVendite/ImportoIva + breakdown IVA per aliquota:
            // punto di calcolo unico condiviso con le mutation Vendite
            await BreakdownIvaApplier.ApplicaAsync(db, registro, settings.VatRate, _logger);

            await _unitOfWork.SaveChangesAsync();
            return registro;
        });

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
                Importo = spesaInput.Importo,
                Categoria = spesaInput.Categoria ?? CategoriaSpesa.Altro
            });
            totaleSpese += spesaInput.Importo;
        }
        return totaleSpese;
    }

    private async Task ProcessaPagamentiFornitori(
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
            existing.Categoria = inp.Categoria;
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

    private async Task CreaPagamentiNuovi(
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
            // Numero/data del documento dipendono dal tipo (FA usa NumeroFattura/DataFattura,
            // DDT usa NumeroDdt/DataDdt). La creazione/collegamento è delegata al servizio condiviso.
            bool isFattura = pagInput.TipoDocumento == "FA";
            var dati = new DocumentiFornitoreService.DatiDocumento(
                FornitoreId: pagInput.FornitoreId,
                TipoDocumento: pagInput.TipoDocumento,
                Numero: isFattura ? pagInput.NumeroFattura : pagInput.NumeroDdt,
                DataDocumento: isFattura ? pagInput.DataFattura : pagInput.DataDdt,
                Importo: pagInput.Importo,
                AliquotaIva: pagInput.AliquotaIva,
                FatturaIdCollegata: pagInput.FatturaId,
                DdtIdCollegato: pagInput.DdtId);

            (int? fatturaId, int? ddtId) = await _documentiService.CreaOCollegaAsync(
                dati, dataRegistro, registroCassa.Id, fattureConsumate, ddtConsumati);

            db.PagamentiFornitori.Add(new PagamentoFornitore
            {
                FatturaId = fatturaId,
                DdtId = ddtId,
                DataPagamento = dataRegistro,
                Importo = pagInput.Importo,
                MetodoPagamento = pagInput.MetodoPagamento,
                Categoria = pagInput.Categoria,
                Note = $"Pagamento da registro cassa del {dataRegistro:dd/MM/yyyy}",
                RegistroCassaId = registroCassa.Id,
            });
        }
    }

    // VenditeContanti, TotaleVendite, ImportoIva e breakdown IVA sono calcolati da
    // BreakdownIvaApplier (VenditeContanti = Σ Vendite persistite, non più azzerato).
    // internal: riusato da AggiungiSpesaSuGiornoOrchestrator (fonte unica della formula, INVARIATA).
    internal static void CalcolaTotali(RegistroCassa registroCassa, decimal totaleSpese)
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
