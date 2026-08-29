using System.Text;
using DuedGusto.Tests.Helpers;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Storage;

namespace DuedGusto.Tests.Unit.Infrastructure;

/// <summary>
/// Riscontro che il <b>modello</b> (le entità di <c>AppDbContext</c>) e le <b>migrazioni</b> (i file
/// in <c>Migrations/</c>) raccontino la stessa storia.
///
/// <para>🔴 <b>Il guasto che questo test esiste per intercettare è già successo.</b> La Fase 3 di
/// <c>ordini-punto-vendita</c> ha aggiunto <c>GestioneCassaGuards.GuardNessunOrdineSulRegistro</c>,
/// che interroga la tabella <c>Ordini</c>, mentre la migrazione che quella tabella la crea è
/// arrivata solo in Fase 4. Nel mezzo la suite era a <b>891 verdi</b> e
/// <c>eliminaRegistroCassa</c> era rotta su <b>ogni</b> database reale, con
/// <c>MySqlException: Table 'duedgusto.ordini' doesn't exist</c>.</para>
///
/// <para><b>Perché nessuno se n'era accorto.</b> Tutta la suite costruisce lo schema con
/// <c>EnsureCreated()</c>, che lo deduce <i>dal modello</i> e ignora del tutto la cartella
/// <c>Migrations/</c> (vedi <see cref="TestDbContextFactory"/>). In un test la tabella <c>Ordini</c>
/// c'era perché c'era il <c>DbSet</c>; in produzione c'era solo se qualcuno aveva scritto la
/// migrazione. Le due cose potevano divergere per giorni senza che un solo test cambiasse colore.
/// <c>Migrate()</c> non è chiamato da nessuna parte, e non può esserlo: le migrazioni sono
/// MySQL-specifiche (Pomelo) e non si applicano né a InMemory né a Sqlite.</para>
///
/// <para><b>Come funziona.</b> Si chiede a EF Core la stessa cosa che si chiederebbe con
/// <c>dotnet ef migrations add</c>: «dato lo stato registrato nell'ultimo snapshot, il modello di
/// oggi produrrebbe altre operazioni?». Se la risposta non è «nessuna», manca una migrazione. Il
/// confronto è puramente sui metadati: <b>nessun database viene contattato</b>, quindi il test gira
/// in CI dove MySQL non esiste (vedi <c>.github/workflows/deploy.yml</c>, che esegue
/// <c>dotnet test</c> su ubuntu-latest senza alcun servizio database).</para>
///
/// <para>🔴 <b>CHE COSA QUESTO TEST NON PROVA.</b> Verifica che una migrazione <i>esista</i> per
/// ogni modifica del modello, non che <i>funzioni</i>:</para>
/// <list type="bullet">
///   <item>non applica lo SQL a un server, quindi non intercetta una migrazione che fallisce
///   all'esecuzione (una <c>AddColumn NOT NULL</c> senza default su una tabella già piena, una
///   FK verso righe orfane, un indice troppo lungo per il charset);</item>
///   <item>non vede i dati: nulla che riguardi il contenuto delle tabelle esistenti;</item>
///   <item>non vede ciò che sta <b>fuori</b> dal modello EF — viste, trigger, stored procedure,
///   indici creati a mano sul server;</item>
///   <item>non prova che la produzione sia aggiornata: dice che il codice è coerente con sé stesso,
///   non che qualcuno abbia eseguito le migrazioni sul server;</item>
///   <item>resta cieco al caso in cui modello <i>e</i> snapshot sono sbagliati allo stesso modo.</item>
/// </list>
/// <para>Quella copertura richiederebbe un <c>Migrate()</c> su MySQL vero, cioè un servizio MySQL in
/// CI che oggi non c'è. Se un giorno ci sarà, questo test resta comunque il più veloce dei due e va
/// tenuto: gira in millisecondi e indica esattamente il rimedio.</para>
/// </summary>
public class MigrazioniAllineateAlModelloTests
{
    /// <summary>
    /// Il modello non deve avere modifiche non ancora riversate in una migrazione.
    /// È l'equivalente di <c>dotnet ef migrations has-pending-model-changes</c> (comando che esiste
    /// solo da EF 9; qui si sta su EF 8.0.13 e si usa direttamente il servizio che quel comando usa).
    /// </summary>
    [Fact]
    public void IlModelloNonDeveAvereModificheSenzaMigrazione()
    {
        using var context = TestDbContextFactory.CreateMySqlSoloMetadati();

        var snapshot = LeggiModelloDelloSnapshot(context);
        var modelloCorrente = context.GetService<IDesignTimeModel>().Model;

        var differenze = context
            .GetService<IMigrationsModelDiffer>()
            .GetDifferences(snapshot.GetRelationalModel(), modelloCorrente.GetRelationalModel());

        differenze.Count.Should().Be(0,
            "il modello di AppDbContext è cambiato senza che sia stata creata la migrazione corrispondente.\n"
            + "\n"
            + "COSA FARE — dalla cartella backend/:\n"
            + "    dotnet ef migrations add <NomeDescrittivo>\n"
            + "poi rilanciare `dotnet test`.\n"
            + "\n"
            + "PERCHÉ IMPORTA — i test costruiscono lo schema con EnsureCreated() dal modello, quindi\n"
            + "restano verdi anche quando la tabella o la colonna non esiste su nessun database reale.\n"
            + "È già successo: la guardia sugli ordini interrogava `Ordini` prima che la migrazione la\n"
            + "creasse, e la suite era tutta verde mentre eliminaRegistroCassa era rotta in produzione.\n"
            + "\n"
            + "OPERAZIONI CHE MANCANO ALLE MIGRAZIONI:\n{0}",
            DescriviOperazioni(differenze));
    }

    /// <summary>
    /// Lo snapshot deve descrivere lo stato prodotto dall'<b>ultima migrazione presente</b>.
    ///
    /// <para>Intercetta un guasto diverso dal precedente e che il diff modello↔snapshot non vede: un
    /// file di migrazione sparito (un <c>migrations remove</c> lasciato a metà, un merge risolto
    /// tenendo lo snapshot di un ramo e le migrazioni dell'altro). In quel caso modello e snapshot
    /// restano d'accordo fra loro — e sbagliati entrambi — mentre su un database vuoto le migrazioni
    /// applicate non ricostruirebbero più lo schema atteso.</para>
    ///
    /// <para>⚠️ <b>Si confronta solo l'ultima, non tutta la catena</b>, e non per pigrizia: la storia
    /// di questo repository contiene già migrazioni i cui modelli intermedi non si concatenano. Il
    /// Designer di <c>20260813153823_AddMetodoPagamentoVendita</c> non conosce le colonne
    /// <c>ImmagineEroe*</c> introdotte da <c>20260813141525_SlotImmaginiPagineVetrina</c>, che pure ha
    /// un id precedente: sono nate su rami paralleli e sono state fuse in ordine. È innocuo — le
    /// <c>Up()</c> si applicano in sequenza e ciascuna fa la sua parte — ma un test che pretendesse la
    /// catena completa nascerebbe rosso su storia passata e verrebbe cancellato entro un'ora.</para>
    /// </summary>
    [Fact]
    public void LoSnapshotDeveCorrispondereAllUltimaMigrazione()
    {
        using var context = TestDbContextFactory.CreateMySqlSoloMetadati();

        var migrationsAssembly = context.GetService<IMigrationsAssembly>();
        var ultima = migrationsAssembly.Migrations.Keys.LastOrDefault();

        ultima.Should().NotBeNull("in backend/Migrations/ non è stata trovata nessuna migrazione: "
            + "o l'assembly delle migrazioni non è quello atteso, o i file sono stati rimossi.");

        var modelloUltimaMigrazione = FinalizzaModello(
            context,
            migrationsAssembly
                .CreateMigration(migrationsAssembly.Migrations[ultima!], context.GetService<IDatabaseProvider>().Name)
                .TargetModel);

        var differenze = context
            .GetService<IMigrationsModelDiffer>()
            .GetDifferences(
                modelloUltimaMigrazione.GetRelationalModel(),
                LeggiModelloDelloSnapshot(context).GetRelationalModel());

        differenze.Count.Should().Be(0,
            "AppDbContextModelSnapshot.cs non descrive lo stato prodotto dall'ultima migrazione ({0}).\n"
            + "\n"
            + "Di solito significa che una migrazione è stata cancellata a mano o persa in un merge,\n"
            + "lasciando lo snapshot avanti rispetto ai file che restano. Uno schema ricostruito da zero\n"
            + "con `dotnet ef database update` non sarebbe più quello che i test si aspettano.\n"
            + "\n"
            + "COSA FARE — dalla cartella backend/: ricreare la migrazione mancante con\n"
            + "`dotnet ef migrations add <NomeDescrittivo>`, oppure annullare la rimozione parziale con\n"
            + "`dotnet ef migrations remove` (che riallinea anche lo snapshot).\n"
            + "\n"
            + "DIFFERENZE FRA ULTIMA MIGRAZIONE E SNAPSHOT:\n{1}",
            ultima,
            DescriviOperazioni(differenze));
    }

    /// <summary>
    /// Il modello registrato in <c>AppDbContextModelSnapshot</c>, portato nella stessa forma
    /// «finalizzata e inizializzata» del modello del contesto: senza questo passaggio il confronto
    /// segnalerebbe differenze che non esistono.
    /// </summary>
    private static IModel LeggiModelloDelloSnapshot(AppDbContext context)
    {
        var snapshot = context.GetService<IMigrationsAssembly>().ModelSnapshot;

        snapshot.Should().NotBeNull(
            "non è stato trovato AppDbContextModelSnapshot in backend/Migrations/: senza snapshot EF Core "
            + "non sa da quale stato partire e ogni `migrations add` rigenererebbe l'intero schema.");

        return FinalizzaModello(context, snapshot!.Model);
    }

    private static IModel FinalizzaModello(AppDbContext context, IModel modello)
    {
        // Lo snapshot e le migrazioni espongono un modello ancora mutabile e non validato: va portato
        // allo stesso stadio del modello del contesto, altrimenti mancano le strutture relazionali su
        // cui il diff lavora. È la stessa sequenza che EF Core esegue in `migrations add`.
        if (modello is IMutableModel mutabile)
        {
            modello = mutabile.FinalizeModel();
        }

        return context.GetService<IModelRuntimeInitializer>().Initialize(modello, designTime: true, validationLogger: null);
    }

    /// <summary>
    /// Traduce le operazioni del diff in righe leggibili: «quale tabella, quale colonna». L'elenco
    /// grezzo di <c>MigrationOperation</c> stamperebbe solo nomi di classe, che non dicono dove
    /// guardare.
    /// </summary>
    private static string DescriviOperazioni(IReadOnlyList<MigrationOperation> operazioni)
    {
        if (operazioni.Count == 0)
        {
            return "  (nessuna)";
        }

        var righe = new StringBuilder();
        foreach (var operazione in operazioni)
        {
            var dettaglio = operazione switch
            {
                CreateTableOperation op => $"tabella nuova: {op.Name}",
                DropTableOperation op => $"tabella rimossa: {op.Name}",
                RenameTableOperation op => $"tabella rinominata: {op.Name} -> {op.NewName}",
                AddColumnOperation op => $"colonna nuova: {op.Table}.{op.Name}",
                DropColumnOperation op => $"colonna rimossa: {op.Table}.{op.Name}",
                AlterColumnOperation op => $"colonna modificata: {op.Table}.{op.Name}",
                RenameColumnOperation op => $"colonna rinominata: {op.Table}.{op.Name} -> {op.NewName}",
                CreateIndexOperation op => $"indice nuovo: {op.Table} ({string.Join(", ", op.Columns)})",
                DropIndexOperation op => $"indice rimosso: {op.Table}.{op.Name}",
                AddForeignKeyOperation op => $"chiave esterna nuova: {op.Table}.{op.Name}",
                DropForeignKeyOperation op => $"chiave esterna rimossa: {op.Table}.{op.Name}",
                _ => operazione.GetType().Name,
            };

            righe.AppendLine($"  - {dettaglio}");
        }

        return righe.ToString().TrimEnd();
    }
}
