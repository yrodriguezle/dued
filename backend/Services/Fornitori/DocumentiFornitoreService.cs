using Microsoft.EntityFrameworkCore;

using GraphQL;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.Models;

namespace duedgusto.Services.Fornitori;

/// <summary>
/// Servizio condiviso per la creazione/collegamento dei documenti fornitore
/// (<see cref="FatturaAcquisto"/> / <see cref="DocumentoTrasporto"/>) a partire dai dati
/// di una riga di pagamento. Incapsula la logica — precedentemente duplicata in
/// <c>MutateRegistroCassaOrchestrator</c> — di:
/// <list type="bullet">
///   <item>lookup/riuso del documento esistente sulla chiave UNIQUE (FornitoreId, Numero);</item>
///   <item>normalizzazione del numero mancante con placeholder deterministico <c>SN-{yyyyMMdd}-{seq}</c>;</item>
///   <item>guard anti-doppia-registrazione (documento già pagato in un contesto diverso);</item>
///   <item>scorporo IVA e valorizzazione degli importi del documento.</item>
/// </list>
///
/// <para>Il servizio è agnostico rispetto al contesto (registro cassa o chiusura mensile):
/// il chiamante decide come collegare il <see cref="PagamentoFornitore"/> risultante
/// (con <c>RegistroCassaId</c> valorizzato per la cassa, oppure <c>null</c> per l'origine-chiusura).</para>
///
/// <para>Usa l'<see cref="AppDbContext"/> scoped iniettato: è la STESSA istanza di
/// <c>IUnitOfWork.Context</c> nella richiesta, quindi le <c>SaveChanges</c> interne
/// partecipano alla transazione governata dal chiamante.</para>
/// </summary>
public class DocumentiFornitoreService
{
    private readonly AppDbContext _dbContext;

    public DocumentiFornitoreService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Dati di input per creare/collegare un documento fornitore a una riga di pagamento.
    /// </summary>
    /// <param name="FornitoreId">Fornitore del documento.</param>
    /// <param name="TipoDocumento">"FA" (fattura acquisto) o "DDT" (documento di trasporto).</param>
    /// <param name="Numero">Numero documento; se vuoto/null viene generato un placeholder SN-*.</param>
    /// <param name="DataDocumento">Data del documento; se null usa <c>dataDefault</c>.</param>
    /// <param name="Importo">Importo lordo (IVA inclusa) del documento.</param>
    /// <param name="AliquotaIva">Aliquota IVA in PERCENTUALE (es. 22); se null usa quella del fornitore o 22.</param>
    /// <param name="ImportoIva">IVA letta dalla fattura, quando l'operatore la digita invece di
    /// farla calcolare dall'aliquota (fattura multialiquota). Se valorizzata PREVALE su
    /// <paramref name="AliquotaIva"/>. Ignorata per i DDT, che non hanno scorporo.</param>
    /// <param name="FatturaIdCollegata">Se valorizzato, collega a una fattura esistente senza crearne una.</param>
    /// <param name="DdtIdCollegato">Se valorizzato, collega a un DDT esistente senza crearne uno.</param>
    public sealed record DatiDocumento(
        int FornitoreId,
        string TipoDocumento,
        string? Numero,
        DateTime? DataDocumento,
        decimal Importo,
        decimal? AliquotaIva,
        int? FatturaIdCollegata,
        int? DdtIdCollegato,
        decimal? ImportoIva = null);

    /// <summary>
    /// Crea (o riusa/collega) il documento fornitore per la riga indicata e ritorna gli id risultanti.
    /// Esattamente uno tra <c>FatturaId</c> e <c>DdtId</c> è valorizzato.
    /// </summary>
    /// <param name="dati">Dati del documento.</param>
    /// <param name="dataDefault">Data di fallback per il documento e i placeholder (data del registro/pagamento).</param>
    /// <param name="registroCassaCorrente">
    /// Contesto anti-doppia-registrazione: id del registro cassa "proprietario" della riga
    /// (per la cassa) oppure <c>null</c> per l'origine-chiusura. Un documento già pagato da un
    /// contesto DIVERSO (RegistroCassaId != <paramref name="registroCassaCorrente"/>) è considerato
    /// doppia registrazione e genera un errore bloccante.
    /// </param>
    /// <param name="fattureConsumate">Insieme delle fatture già consumate nella stessa richiesta (per placeholder multipli).</param>
    /// <param name="ddtConsumati">Insieme dei DDT già consumati nella stessa richiesta (per placeholder multipli).</param>
    public async Task<(int? FatturaId, int? DdtId)> CreaOCollegaAsync(
        DatiDocumento dati,
        DateTime dataDefault,
        int? registroCassaCorrente,
        HashSet<int> fattureConsumate,
        HashSet<int> ddtConsumati)
    {
        // Stesso ordine di decisione del vecchio CreaPagamentiNuovi:
        // 1) fattura esistente esplicita → collega; 2) tipo FA → crea/riusa fattura;
        // 3) ddt esistente esplicito → collega; 4) altrimenti → crea/riusa DDT.
        if (dati.FatturaIdCollegata != null)
            return (dati.FatturaIdCollegata, null);

        if (dati.TipoDocumento == "FA")
            return (await CreaFatturaAcquistoAsync(dati, dataDefault, registroCassaCorrente, fattureConsumate), null);

        if (dati.DdtIdCollegato != null)
            return (null, dati.DdtIdCollegato);

        return (null, await CreaDocumentoTrasportoAsync(dati, dataDefault, registroCassaCorrente, ddtConsumati));
    }

    private async Task<int> CreaFatturaAcquistoAsync(
        DatiDocumento dati,
        DateTime dataDefault,
        int? registroCassaCorrente,
        HashSet<int> fattureConsumate)
    {
        string numeroFattura = (dati.Numero ?? "").Trim();
        FatturaAcquisto? existing = null;

        if (numeroFattura.Length > 0)
        {
            // Lookup sulla stessa chiave dell'indice UNIQUE (FornitoreId, NumeroFattura)
            existing = await _dbContext.FattureAcquisto
                .Include(f => f.Pagamenti)
                .FirstOrDefaultAsync(f =>
                    f.FornitoreId == dati.FornitoreId &&
                    f.NumeroFattura == numeroFattura);

            // Pagamenti di un contesto DIVERSO da quello corrente → vera doppia registrazione
            // (errore bloccante). Pagamenti solo del contesto corrente (riscrittura) o nessun
            // pagamento → riuso.
            if (existing != null && existing.Pagamenti.Any(p => p.RegistroCassaId != registroCassaCorrente))
            {
                throw new ExecutionError(
                    $"La fattura n. {numeroFattura} del fornitore (Id: {dati.FornitoreId}) " +
                    $"è già registrata in un altro contesto (FatturaId: {existing.FatturaId}). " +
                    "Non è possibile registrare due volte la stessa fattura.");
            }
        }
        else
        {
            // Numero vuoto → normalizzazione con placeholder deterministico SN-{yyyyMMdd}-{seq}
            string prefix = PlaceholderPrefix(dataDefault);
            List<FatturaAcquisto> candidate = await _dbContext.FattureAcquisto
                .Include(f => f.Pagamenti)
                .Where(f => f.FornitoreId == dati.FornitoreId && f.NumeroFattura.StartsWith(prefix))
                .ToListAsync();

            // Riusa la prima fattura placeholder "libera": non consumata da un'altra riga
            // della stessa richiesta e senza pagamenti di contesti diversi dal corrente.
            existing = candidate
                .Where(f => !fattureConsumate.Contains(f.FatturaId))
                .FirstOrDefault(f => f.Pagamenti.All(p => p.RegistroCassaId == registroCassaCorrente));

            if (existing == null)
            {
                numeroFattura = ProssimoNumeroPlaceholder(prefix, candidate.Select(f => f.NumeroFattura));
            }
        }

        RisultatoIva scorporo = await RipartisciImportoFatturaAsync(dati);

        if (existing != null)
        {
            // Riuso: aggiorna gli importi con lo stesso scorporo dell'update pagamenti
            existing.DataFattura = dati.DataDocumento ?? dataDefault;
            existing.Imponibile = scorporo.Imponibile;
            existing.ImportoIva = scorporo.Iva;
            existing.TotaleConIva = scorporo.Totale;
            existing.IvaCalcolata = dati.ImportoIva is null;
            existing.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
            fattureConsumate.Add(existing.FatturaId);
            return existing.FatturaId;
        }

        var fattura = new FatturaAcquisto
        {
            FornitoreId = dati.FornitoreId,
            NumeroFattura = numeroFattura,
            DataFattura = dati.DataDocumento ?? dataDefault,
            Imponibile = scorporo.Imponibile,
            ImportoIva = scorporo.Iva,
            TotaleConIva = scorporo.Totale,
            IvaCalcolata = dati.ImportoIva is null,
            Stato = "PAGATA",
        };
        _dbContext.FattureAcquisto.Add(fattura);
        await _dbContext.SaveChangesAsync();
        fattureConsumate.Add(fattura.FatturaId);
        return fattura.FatturaId;
    }

    private async Task<int> CreaDocumentoTrasportoAsync(
        DatiDocumento dati,
        DateTime dataDefault,
        int? registroCassaCorrente,
        HashSet<int> ddtConsumati)
    {
        string numero = (dati.Numero ?? "").Trim();

        if (numero.Length > 0)
        {
            // Lookup sulla stessa chiave dell'indice UNIQUE (FornitoreId, NumeroDdt)
            DocumentoTrasporto? existing = await _dbContext.DocumentiTrasporto
                .FirstOrDefaultAsync(d =>
                    d.FornitoreId == dati.FornitoreId &&
                    d.NumeroDdt == numero);

            if (existing != null)
            {
                existing.DataDdt = dati.DataDocumento ?? dataDefault;
                existing.Importo = dati.Importo;
                existing.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                ddtConsumati.Add(existing.DdtId);
                return existing.DdtId;
            }
        }
        else
        {
            // Numero vuoto → normalizzazione con placeholder deterministico SN-{yyyyMMdd}-{seq}
            string prefix = PlaceholderPrefix(dataDefault);
            List<DocumentoTrasporto> candidati = await _dbContext.DocumentiTrasporto
                .Include(d => d.Pagamenti)
                .Where(d => d.FornitoreId == dati.FornitoreId && d.NumeroDdt.StartsWith(prefix))
                .ToListAsync();

            // Riusa il primo DDT placeholder "libero": non consumato da un'altra riga
            // della stessa richiesta e senza pagamenti di contesti diversi dal corrente.
            DocumentoTrasporto? libero = candidati
                .Where(d => !ddtConsumati.Contains(d.DdtId))
                .FirstOrDefault(d => d.Pagamenti.All(p => p.RegistroCassaId == registroCassaCorrente));

            if (libero != null)
            {
                libero.DataDdt = dati.DataDocumento ?? dataDefault;
                libero.Importo = dati.Importo;
                libero.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                ddtConsumati.Add(libero.DdtId);
                return libero.DdtId;
            }

            numero = ProssimoNumeroPlaceholder(prefix, candidati.Select(d => d.NumeroDdt));
        }

        var ddt = new DocumentoTrasporto
        {
            FornitoreId = dati.FornitoreId,
            NumeroDdt = numero,
            DataDdt = dati.DataDocumento ?? dataDefault,
            Importo = dati.Importo,
            FatturaId = null,
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        await _dbContext.SaveChangesAsync();
        ddtConsumati.Add(ddt.DdtId);
        return ddt.DdtId;
    }

    /// <summary>
    /// Ripartisce l'importo lordo della riga tra imponibile e IVA. Se l'operatore ha digitato
    /// l'IVA presa dalla fattura (multialiquota) quella è un DATO e va usata tale e quale;
    /// altrimenti si scorpora dall'aliquota (input → fornitore → 22).
    /// </summary>
    private async Task<RisultatoIva> RipartisciImportoFatturaAsync(DatiDocumento dati)
    {
        if (dati.ImportoIva is decimal ivaDaDocumento)
        {
            return IvaCalculator.RipartisciConIvaNota(dati.Importo, ivaDaDocumento);
        }

        decimal aliquota = await RisolviAliquotaPercentualeAsync(dati.AliquotaIva, dati.FornitoreId);
        return IvaCalculator.ScorporaDaLordo(dati.Importo, IvaCalculator.AliquotaDaPercentuale(aliquota));
    }

    /// <summary>
    /// Risolve l'aliquota IVA in PERCENTUALE: input esplicito, altrimenti quella del fornitore, altrimenti 22.
    /// </summary>
    private async Task<decimal> RisolviAliquotaPercentualeAsync(decimal? aliquotaInput, int fornitoreId)
    {
        if (aliquotaInput != null)
            return aliquotaInput.Value;

        Fornitore? fornitore = await _dbContext.Set<Fornitore>().FindAsync(fornitoreId);
        return fornitore?.AliquotaIva ?? 22m;
    }

    /// <summary>
    /// Prefisso del numero placeholder per documenti senza numero: "SN-{yyyyMMdd}-"
    /// (SN = senza numero, data di competenza).
    /// </summary>
    public static string PlaceholderPrefix(DateTime data)
        => $"SN-{data:yyyyMMdd}-";

    /// <summary>
    /// Primo numero placeholder libero per il prefisso dato: "SN-{yyyyMMdd}-{seq}"
    /// con seq ≥ 1 non ancora usato tra i numeri esistenti (lunghezza ≤ 50, MaxLength dei campi numero).
    /// </summary>
    public static string ProssimoNumeroPlaceholder(string prefix, IEnumerable<string> numeriEsistenti)
    {
        HashSet<int> occupati = numeriEsistenti
            .Select(n => int.TryParse(n[prefix.Length..], out int seq) ? seq : 0)
            .Where(seq => seq > 0)
            .ToHashSet();

        int prossimo = Enumerable.Range(1, occupati.Count + 1).First(seq => !occupati.Contains(seq));
        return $"{prefix}{prossimo}";
    }
}
