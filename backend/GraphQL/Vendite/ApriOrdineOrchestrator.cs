using GraphQL;
using Microsoft.EntityFrameworkCore;

using duedgusto.Common;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.Models;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;

namespace duedgusto.GraphQL.Vendite;

/// <summary>
/// Apre un conto al bancone. È l'unica operazione del punto vendita che <b>non</b> ha niente a che
/// fare con i soldi: nasce un <c>Ordine</c> in stato <see cref="StatiOrdine.Aperto"/> e nient'altro
/// si muove — nessuna <c>Vendita</c>, nessun secchio, nessuna riga IVA.
/// </summary>
public class ApriOrdineOrchestrator
{
    /// <summary>
    /// Quante volte si ritenta l'inserimento quando il progressivo scelto è già stato preso da un
    /// altro dispositivo. Tre: oltre, il problema non è più una corsa ma un guasto, e insistere lo
    /// nasconderebbe.
    /// </summary>
    private const int TentativiNumerazione = 3;

    private readonly IUnitOfWork _unitOfWork;
    private readonly ChiusuraMensileService _chiusuraService;

    public ApriOrdineOrchestrator(IUnitOfWork unitOfWork, ChiusuraMensileService chiusuraService)
    {
        _unitOfWork = unitOfWork;
        _chiusuraService = chiusuraService;
    }

    public async Task<Ordine> ExecuteAsync(int registroCassaId, int? utenteId)
    {
        AppDbContext db = _unitOfWork.Context;

        RegistroCassa registro = await db.RegistriCassa
                .FirstOrDefaultAsync(r => r.Id == registroCassaId)
            ?? throw new ExecutionError($"Registro cassa con ID {registroCassaId} non trovato.");

        await GestioneCassaGuards.GuardMeseChiuso(_chiusuraService, registro.Data);

        // Un registro chiuso ha già dichiarato il suo incasso: aprirci un ordine sopra creerebbe
        // un incasso che nessuna chiusura potrà più contare. È la prima delle due guardie contro
        // quella finestra — la seconda è il conteggio degli ordini aperti dentro la chiusura di
        // cassa, che copre chi fosse già passato di qui.
        if (registro.Stato is "CLOSED" or "RECONCILED")
        {
            throw new ExecutionError(
                $"Impossibile aprire un ordine: il registro del {registro.Data:dd/MM/yyyy} è già chiuso.");
        }

        var ordine = new Ordine
        {
            RegistroCassaId = registro.Id,
            SuffissoSplit = string.Empty,
            Stato = StatiOrdine.Aperto,
            TotaleOrdine = 0m,
            ApertoDa = utenteId,
            ApertoIl = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Ordini.Add(ordine);

        // 🔴 L'indice unico è la CORRETTEZZA, il retry è solo l'ergonomia: non invertire i ruoli.
        //    MAX(Numero)+1 ha una corsa — due operatori che aprono nello stesso istante leggono lo
        //    stesso massimo — e senza l'indice la collisione sarebbe MUTA: due ticket stampati
        //    identici, scoperti quando qualcuno incassa quello sbagliato. L'indice la trasforma in
        //    un insert fallito; questo ciclo fa in modo che l'operatore veda un ordine nuovo
        //    invece di un errore. Ritentare è sicuro perché apriOrdine non crea nient'altro:
        //    l'unica riga in gioco è quella che non è stata scritta.
        for (int tentativo = 1; ; tentativo++)
        {
            ordine.Numero = await ProssimoNumeroAsync(db, registro.Id);

            try
            {
                await _unitOfWork.SaveChangesAsync();
                return ordine;
            }
            catch (DbUpdateException) when (tentativo < TentativiNumerazione)
            {
                // La riga non è stata scritta e resta Added: al giro dopo si rilegge il massimo —
                // che nel frattempo è cresciuto — e si ritenta con quello.
            }
            catch (DbUpdateException)
            {
                throw new ExecutionError(
                    "Impossibile assegnare un numero all'ordine: troppi ordini aperti nello stesso " +
                    "istante. Riprova fra un momento.");
            }
        }
    }

    /// <summary>
    /// Il progressivo successivo <b>sul registro</b>, non globale: i numeri ricominciano da 1 ogni
    /// giorno, perché è così che si leggono su un ticket.
    ///
    /// <para>I figli di uno split <b>non</b> consumano un numero — ereditano quello del padre e si
    /// distinguono per suffisso — quindi <c>MAX</c> li conta senza doverli escludere.</para>
    /// </summary>
    private static async Task<int> ProssimoNumeroAsync(AppDbContext db, int registroCassaId)
    {
        int massimo = await db.Ordini
            .Where(o => o.RegistroCassaId == registroCassaId)
            .Select(o => (int?)o.Numero)
            .MaxAsync() ?? 0;

        return massimo + 1;
    }
}
