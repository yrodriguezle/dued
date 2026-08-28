using System.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Factory per creare istanze di AppDbContext per i test.
///
/// <para><b>Due provider, due mestieri.</b> <see cref="Create"/> usa InMemory ed è la strada
/// normale: veloce, isolata, e sufficiente per la stragrande maggioranza della suite.
/// <see cref="CreateSqlite()"/> è <b>aggiuntiva</b>, non sostitutiva, e serve ai soli test che
/// hanno bisogno di ciò che InMemory non fa:</para>
/// <list type="bullet">
///   <item><b>transazioni vere</b> — su InMemory <c>BeginTransactionAsync</c> è un no-op, tanto che
///   <see cref="Create"/> deve sopprimere <c>InMemoryEventId.TransactionIgnoredWarning</c>: un
///   rollback non annulla nulla e «l'operazione è atomica» non è dimostrabile;</item>
///   <item><b>token di concorrenza applicati</b> — la guardia che impedisce il doppio incasso si
///   regge su una UPDATE condizionata di cui si contano le righe toccate;</item>
///   <item><b>indici unici applicati</b> — InMemory accetta i duplicati, quindi un test sulla
///   corsa al numero d'ordine passerebbe verde senza provare niente.</item>
/// </list>
///
/// <para>🔴 <b>Che cosa Sqlite NON prova.</b> Sqlite non è MySQL: non riproduce il locking di riga
/// di InnoDB né la semantica di <c>SELECT … FOR UPDATE</c> sotto <c>REPEATABLE READ</c>. Prova la
/// <i>logica delle righe toccate</i> — che è la forma della guardia — non il comportamento del
/// motore in produzione. Quello resta verificabile solo su MySQL vero.</para>
/// </summary>
public static class TestDbContextFactory
{
    /// <summary>
    /// Crea un AppDbContext con InMemory database.
    /// Ogni test usa un databaseName univoco per l'isolamento.
    /// </summary>
    public static AppDbContext Create(string? databaseName = null)
    {
        databaseName ??= Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            // Il provider InMemory non supporta le transazioni: senza questo warning
            // soppresso, BeginTransactionAsync (usato da ChiusuraMensileService) lancerebbe.
            // Le transazioni diventano no-op nei test (comportamento standard del provider).
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var context = new AppDbContext(options, CreateConfigurationMock());
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Crea un contesto e lo popola con dati seed.
    /// </summary>
    public static AppDbContext CreateWithSeed(Action<AppDbContext> seedAction, string? databaseName = null)
    {
        var context = Create(databaseName);
        seedAction(context);
        context.SaveChanges();
        return context;
    }

    /// <summary>
    /// Apre una connessione Sqlite in memoria e la restituisce <b>già aperta</b>.
    ///
    /// <para>🔴 <b>Va tenuta viva per tutta la durata del test</b> (un <c>using</c> nel corpo del
    /// test, non nel metodo che la crea). Un database <c>:memory:</c> vive quanto la sua
    /// connessione: quando l'ultima si chiude, tabelle e dati spariscono — e il test successivo su
    /// quella stessa connessione fallirebbe con «no such table», che è un sintomo che non somiglia
    /// affatto alla sua causa.</para>
    ///
    /// <para>Serve quando un test ha bisogno di <b>più contesti sullo stesso database</b>: due
    /// scrittori concorrenti, o una rilettura che deve scavalcare l'identity map. In quei casi si
    /// crea la connessione qui e la si passa a <see cref="CreateSqlite(SqliteConnection)"/> tante
    /// volte quanti sono i contesti.</para>
    /// </summary>
    public static SqliteConnection CreateSqliteConnection()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        return connection;
    }

    /// <summary>
    /// Crea un AppDbContext su un database Sqlite in memoria di cui il contesto è <b>proprietario</b>:
    /// la connessione si chiude — e il database sparisce — quando il contesto viene disposto.
    ///
    /// <para>Da usare quando al test basta un contesto solo. Se ne servono due o più sullo stesso
    /// database, partire da <see cref="CreateSqliteConnection"/> e usare
    /// <see cref="CreateSqlite(SqliteConnection)"/>.</para>
    /// </summary>
    public static AppDbContext CreateSqlite()
        => CreateSqlite(CreateSqliteConnection(), contextOwnsConnection: true);

    /// <summary>
    /// Crea un AppDbContext su una connessione Sqlite <b>già aperta e di proprietà del chiamante</b>.
    /// Chiamando più volte questo metodo con la stessa connessione si ottengono contesti distinti
    /// sullo stesso database, ciascuno con la propria identity map — che è ciò che serve per
    /// simulare due operatori concorrenti.
    /// </summary>
    public static AppDbContext CreateSqlite(SqliteConnection connection)
        => CreateSqlite(connection, contextOwnsConnection: false);

    private static AppDbContext CreateSqlite(SqliteConnection connection, bool contextOwnsConnection)
    {
        if (connection.State != ConnectionState.Open)
        {
            connection.Open();
        }

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection, contextOwnsConnection)
            // Senza questo, EnsureCreated() non parte affatto: AppDbContext configura
            // `HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")` su 14 entità,
            // sintassi MySQL che Sqlite rifiuta dentro la CREATE TABLE.
            // Il perché di questa forma (e non di un ramo `if (Database.IsSqlite())` in
            // OnModelCreating) è scritto in SqliteTestModelCustomizer.
            .ReplaceService<IModelCustomizer, SqliteTestModelCustomizer>()
            .Options;

        var context = new AppDbContext(options, CreateConfigurationMock());
        // Idempotente: sulla seconda chiamata trova le tabelle già create e non fa nulla.
        context.Database.EnsureCreated();
        return context;
    }

    /// <summary>
    /// Crea un AppDbContext sul provider <b>MySQL</b> (Pomelo) <b>senza mai aprire una connessione</b>.
    ///
    /// <para>Serve a una cosa sola: confrontare il modello con lo snapshot delle migrazioni. Quel
    /// confronto è provider-specifico — lo snapshot in <c>Migrations/AppDbContextModelSnapshot.cs</c>
    /// è stato generato da Pomelo e porta i suoi tipi (<c>varchar(20)</c>, <c>decimal(10,2)</c>) e le
    /// sue annotazioni (<c>MySql:CharSet</c>, <c>MySql:ValueGenerationStrategy</c>). Confrontarlo con
    /// un modello finalizzato da InMemory o da Sqlite produrrebbe una valanga di differenze finte, e
    /// un test rosso sempre non è un test.</para>
    ///
    /// <para>⚠️ <b>Nessun database viene contattato.</b> La stringa di connessione è finta e la
    /// versione del server è dichiarata a mano invece che con <c>ServerVersion.AutoDetect</c>, che
    /// aprirebbe una connessione. Su questo contesto si possono chiamare solo i servizi che lavorano
    /// sui metadati (<c>IDesignTimeModel</c>, <c>IMigrationsAssembly</c>,
    /// <c>IMigrationsModelDiffer</c>): qualunque query, <c>EnsureCreated</c> o <c>Migrate</c>
    /// fallirebbe, perché MySQL non c'è.</para>
    /// </summary>
    public static AppDbContext CreateMySqlSoloMetadati()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql(
                "Server=nessuno;Database=nessuno;User=nessuno;Password=nessuno",
                new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;

        return new AppDbContext(options, CreateConfigurationMock());
    }

    /// <summary>
    /// IConfiguration finta minimale — <c>AppDbContext.OnConfiguring</c> ha un guard
    /// <c>if (!optionsBuilder.IsConfigured)</c> che impedisce di sovrascrivere con MySQL, ma il
    /// costruttore pretende comunque una IConfiguration.
    /// <c>GetConnectionString</c> è un metodo di estensione che legge da
    /// <c>IConfiguration.GetSection("ConnectionStrings")[name]</c>: si finge l'indexer.
    /// </summary>
    private static IConfiguration CreateConfigurationMock()
    {
        var configMock = new Mock<IConfiguration>();
        var connectionStringsSection = new Mock<IConfigurationSection>();
        connectionStringsSection.Setup(s => s[It.IsAny<string>()]).Returns("Server=test;Database=test");
        configMock.Setup(c => c.GetSection("ConnectionStrings")).Returns(connectionStringsSection.Object);
        return configMock.Object;
    }
}
