using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.DataAccess;
using duedgusto.GraphQL.Vetrina.Types;
using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.Services.Vetrina;

namespace duedgusto.GraphQL.Vetrina;

/// <summary>
/// Letture amministrative della vetrina. Il ramo gemello di <see cref="VetrinaMutations"/> fra
/// le query: il ramo root dice al lettore in che territorio si trova, ed è ciò che tiene i dati
/// del sito fuori da <c>settings</c>, che è il territorio della cassa.
///
/// <para>🔴 <b>Due livelli di protezione, distinti e non intercambiabili</b>, come nel ramo delle
/// mutation: <c>this.Authorize()</c> di tipo esclude l'anonimo — ed è ciò che rende questo ramo
/// coperto <b>automaticamente</b> dalle tre Theory enumerative di
/// <c>AutorizzazioneAnonimaTests</c>, senza alcuna allowlist — mentre il guard dentro il resolver
/// esclude l'utente autenticato senza privilegi. Il primo non implica il secondo.</para>
///
/// <para>🔴 <b>Perché il guard amministratore anche in LETTURA</b>, dato che una parte degli
/// stessi dati esce anonima da <c>/api/public/site</c>: perché <b>non sono gli stessi dati</b>.
/// <see cref="ImpostazioniVetrinaType"/> espone <c>turnstileSiteKey</c>, i tre campi delle
/// prenotazioni e tutto ciò che le fasi successive aggiungeranno (note interne, chiavi, flag
/// operativi), mentre il DTO pubblico espone un sottoinsieme scelto a mano. Il guard è ciò che
/// impedisce a quell'asimmetria di diventare un caso il giorno in cui il tipo di amministrazione
/// cresce. È il precedente già stabilito per <c>connection { mediaAssets }</c>: <i>aprirla dopo è
/// una riga; accorgersi che era aperta è un incidente</i>.</para>
/// </summary>
public class VetrinaQueries : ObjectGraphType
{
    public VetrinaQueries()
    {
        this.Authorize();

        Field<ImpostazioniVetrinaType, ImpostazioniVetrina?>("impostazioni")
            .Description("Le impostazioni del sito. Riservate agli amministratori anche in "
                + "lettura: questo tipo espone campi che la rotta pubblica non contiene.")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                // Prima istruzione, prima di qualunque lettura: come le mutation del ramo.
                await VetrinaMutations.GuardAmministratore(context, dbContext);

                return await LeggiImpostazioniAsync(dbContext);
            });

        Field<ListGraphType<RecensioneVetrinaType>, IReadOnlyList<RecensioneVetrina>>("recensioni")
            .Description("Le recensioni riportate sul sito, PUBBLICATE E NON, nell'ordine in cui "
                + "l'amministratore le ha messe. La rotta pubblica ne restituisce solo il "
                + "sottoinsieme pubblicato: è la stessa asimmetria delle impostazioni.")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                await VetrinaMutations.GuardAmministratore(context, dbContext);

                return await LeggiRecensioniAsync(dbContext, solePubblicate: false);
            });
    }

    /// <summary>
    /// Le recensioni nell'ordine di pagina. L'ordine vive in <see cref="OrdineRecensioni"/> perché
    /// lo condivide con la rotta pubblica: l'anteprima che l'amministratore usa per riordinarle
    /// non serve a niente se l'ordine del sito è un altro.
    /// </summary>
    internal static Task<List<RecensioneVetrina>> LeggiRecensioniAsync(
        AppDbContext dbContext, bool solePubblicate)
    {
        IQueryable<RecensioneVetrina> query = dbContext.RecensioniVetrina.AsNoTracking();
        if (solePubblicate) query = query.Where(recensione => recensione.Pubblicata);

        return OrdineRecensioni.Applica(query).ToListAsync();
    }

    /// <summary>
    /// La riga, letta <b>per identificativo</b> e mai con un <c>FirstOrDefaultAsync()</c> senza
    /// criterio: ce n'è una sola e il database lo impone con un <c>CHECK</c>, quindi chiederla
    /// per nome è anche il modo di dire al lettore che il singleton è un valore di dominio.
    ///
    /// <para>Con la riga assente si restituisce <c>null</c>, che il client sa gestire (la pagina
    /// mostra un modulo vuoto e il primo salvataggio la crea), e <b>non</b> un errore di
    /// infrastruttura. È lo stesso principio della rotta pubblica, che con la riga assente
    /// risponde <c>200</c> con i default invece di far fallire la home del sito.</para>
    /// </summary>
    internal static Task<ImpostazioniVetrina?> LeggiImpostazioniAsync(AppDbContext dbContext) =>
        dbContext.ImpostazioniVetrina
            .Include(impostazioni => impostazioni.ImmagineOg)
            .FirstOrDefaultAsync(impostazioni =>
                impostazioni.ImpostazioniVetrinaId == ImpostazioniVetrina.IdSingleton);
}
