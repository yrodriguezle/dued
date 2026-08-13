using GraphQL;

using duedgusto.Common;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.Services.Fornitori;

namespace duedgusto.GraphQL.Fornitori;

public class FatturaAcquistoOrchestrator
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly RegistroCassaSyncService _syncService;

    public FatturaAcquistoOrchestrator(IUnitOfWork unitOfWork, RegistroCassaSyncService syncService)
    {
        _unitOfWork = unitOfWork;
        _syncService = syncService;
    }

    public async Task<FatturaAcquisto> MutateAsync(FatturaAcquistoInput input, int utenteId)
    {
        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            FatturaAcquisto? fattura;

            if (input.FatturaId.HasValue)
            {
                fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(input.FatturaId.Value)
                    ?? throw new ExecutionError($"Fattura acquisto con ID {input.FatturaId} non trovata");
            }
            else
            {
                fattura = new FatturaAcquisto();
                _unitOfWork.FattureAcquisto.Add(fattura);
            }

            fattura.FornitoreId = input.FornitoreId;
            fattura.NumeroFattura = input.NumeroFattura;
            fattura.DataFattura = input.DataFattura;
            // IVA digitata dall'operatore (fattura multialiquota) → dato, non calcolo:
            // prevale sull'aliquota, che in quel caso non viene nemmeno letta.
            RisultatoIva applicazione = input.ImportoIva is decimal ivaDaDocumento
                ? IvaCalculator.DaImportoEsplicito(input.Imponibile, ivaDaDocumento)
                : IvaCalculator.ApplicaSuImponibile(
                    input.Imponibile, IvaCalculator.AliquotaDaPercentuale(input.AliquotaIva));
            fattura.Imponibile = applicazione.Imponibile;
            fattura.ImportoIva = applicazione.Iva;
            fattura.TotaleConIva = applicazione.Totale;
            // Unico punto in cui la modalità viene decisa per la pagina fattura: da qui in poi
            // è un fatto persistito, non più deducibile dagli importi.
            fattura.IvaCalcolata = input.ImportoIva is null;
            fattura.DataScadenza = input.DataScadenza;
            fattura.Note = input.Note;
            fattura.Stato = input.Stato;
            fattura.UpdatedAt = DateTime.UtcNow;

            await _unitOfWork.SaveChangesAsync();

            // Crea pagamenti se forniti (INSERT con fattura già pagata)
            if (input.Pagamenti?.Count > 0)
            {
                // Il pagamento entra in chiusura solo attraverso il registro cassa del giorno
                // (la chiusura mensile aggrega per RegistroCassaId, mai per DataPagamento):
                // senza questo collegamento la spesa resta orfana e invisibile a qualsiasi mese.
                var registriPerData = new Dictionary<DateTime, RegistroCassa>();

                foreach (PagamentoFornitoreInput pagInput in input.Pagamenti)
                {
                    DateTime dataKey = pagInput.DataPagamento.Date;
                    if (!registriPerData.TryGetValue(dataKey, out RegistroCassa? registro))
                    {
                        registro = await _syncService.FindOrCreateRegistroCassaAsync(pagInput.DataPagamento, utenteId);
                        registriPerData[dataKey] = registro;
                    }

                    _unitOfWork.PagamentiFornitori.Add(new PagamentoFornitore
                    {
                        FatturaId = fattura.FatturaId,
                        DataPagamento = pagInput.DataPagamento,
                        Importo = pagInput.Importo,
                        MetodoPagamento = pagInput.MetodoPagamento,
                        Note = pagInput.Note,
                        RegistroCassaId = registro.Id,
                    });
                }

                await _unitOfWork.SaveChangesAsync();

                // Ricalcola SpeseFornitori per ogni registro coinvolto
                foreach (RegistroCassa registro in registriPerData.Values)
                {
                    await _syncService.RecalculateSpeseFornitoriAsync(registro.Id);
                }

                // Ricalcola stato fattura dopo i pagamenti
                fattura.Pagamenti = (await _unitOfWork.PagamentiFornitori
                    .FindAsync(p => p.FatturaId == fattura.FatturaId)).ToList();
                FatturaAcquistoStatusHelper.RecalculateStato(fattura);

                await _unitOfWork.SaveChangesAsync();
            }

            return fattura;
        });
    }

    public async Task<FatturaAcquisto> AssociaDdtAsync(int fatturaId, List<int> ddtIds)
    {
        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

            List<DocumentoTrasporto> ddtList = (await _unitOfWork.DocumentiTrasporto
                .FindAsync(d => ddtIds.Contains(d.DdtId))).ToList();

            if (ddtList.Count != ddtIds.Count)
                throw new ExecutionError("Uno o più DDT non trovati");

            DocumentoTrasporto? ddtGiaAssociato = ddtList.FirstOrDefault(d => d.FatturaId != null);
            if (ddtGiaAssociato != null)
                throw new ExecutionError($"Il DDT {ddtGiaAssociato.NumeroDdt} è già associato a un'altra fattura");

            DocumentoTrasporto? ddtAltroFornitore = ddtList.FirstOrDefault(d => d.FornitoreId != fattura.FornitoreId);
            if (ddtAltroFornitore != null)
                throw new ExecutionError($"Il DDT {ddtAltroFornitore.NumeroDdt} non appartiene al fornitore della fattura");

            ddtList.ForEach(d => d.FatturaId = fatturaId);
            // Il ricalcolo rilegge i DDT dal database (Where → query, non change tracker):
            // senza questo save le righe appena collegate resterebbero fuori dalla somma.
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaTotaliFatturaAsync(fattura);

            fattura.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
            return fattura;
        });
    }

    public async Task<FatturaAcquisto> DisassociaDdtAsync(int fatturaId, List<int> ddtIds)
    {
        return await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

            List<DocumentoTrasporto> ddtList = (await _unitOfWork.DocumentiTrasporto
                .FindAsync(d => ddtIds.Contains(d.DdtId) && d.FatturaId == fatturaId)).ToList();

            if (ddtList.Count != ddtIds.Count)
                throw new ExecutionError("Uno o più DDT non trovati o non associati a questa fattura");

            ddtList.ForEach(d => d.FatturaId = null);
            // Come in AssociaDdtAsync: senza save i DDT appena staccati verrebbero ancora sommati.
            await _unitOfWork.SaveChangesAsync();

            await RicalcolaTotaliFatturaAsync(fattura);

            fattura.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
            return fattura;
        });
    }

    private async Task RicalcolaTotaliFatturaAsync(FatturaAcquisto fattura)
    {
        List<DocumentoTrasporto> allDdt = (await _unitOfWork.DocumentiTrasporto
            .FindAsync(d => d.FatturaId == fattura.FatturaId)).ToList();

        decimal totale = allDdt.Sum(d => d.Importo ?? 0);

        // IVA digitata (fattura multialiquota): è un dato letto dal documento, si congela e si
        // muove l'imponibile. Riscorporarla significherebbe reinventare un'aliquota che sulla
        // fattura non esiste. È l'unico punto che deve saperlo senza averlo nell'input: legge
        // il flag persistito, non lo deduce dagli importi.
        RisultatoIva risultato;
        if (!fattura.IvaCalcolata && fattura.ImportoIva is decimal ivaDigitata)
        {
            risultato = IvaCalculator.RipartisciConIvaNota(totale, ivaDigitata);
        }
        else
        {
            // Derivazione inversa dell'aliquota dalla fattura (non è una formula IVA: resta invariata)
            decimal aliquota = fattura.ImportoIva != null && fattura.Imponibile > 0
                ? Math.Round(fattura.ImportoIva.Value / fattura.Imponibile * 100, 2)
                : 22m;

            risultato = IvaCalculator.ScorporaDaLordo(
                totale, IvaCalculator.AliquotaDaPercentuale(aliquota));
        }

        fattura.TotaleConIva = risultato.Totale;
        fattura.Imponibile = risultato.Imponibile;
        fattura.ImportoIva = risultato.Iva;
    }

    public async Task<bool> EliminaAsync(int fatturaId)
    {
        FatturaAcquisto fattura = await _unitOfWork.FattureAcquisto.GetByIdAsync(fatturaId)
                ?? throw new ExecutionError($"Fattura acquisto con ID {fatturaId} non trovata");

        _unitOfWork.FattureAcquisto.Remove(fattura);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }
}
