using DuedGusto.Tests.Helpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DuedGusto.Tests.Unit.Infrastructure;

/// <summary>
/// Riscontro della factory Sqlite: prova che il provider applichi davvero <b>ciò per cui è stato
/// aggiunto</b>. Non è un test di cortesia sulla costruzione dello schema — un test che si limita ad
/// aprire una connessione non giustificherebbe una dipendenza in più.
///
/// <para>Le tre capacità verificate qui sono esattamente quelle su cui poggeranno la guardia contro
/// il doppio incasso e la numerazione degli ordini:</para>
/// <list type="number">
///   <item><b>transazioni vere</b> — un rollback non lascia traccia;</item>
///   <item><b>UPDATE condizionata con conteggio delle righe toccate</b> — la prima ne tocca 1, la
///   seconda 0: è la forma stessa della guardia di transizione, e su InMemory
///   <c>ExecuteUpdateAsync</c> non è nemmeno eseguibile;</item>
///   <item><b>token di concorrenza onorati</b> — il secondo scrittore, che ha letto un valore ormai
///   vecchio, viene rifiutato invece di sovrascrivere;</item>
///   <item><b>indici unici applicati</b> — il codice prodotto duplicato viene rifiutato dal
///   database.</item>
/// </list>
///
/// <para>Ogni capacità ha accanto il suo <b>test di contrasto su InMemory</b>, che documenta il
/// comportamento oggi in vigore nella suite. Non sono test difensivi: sono la ragione per cui questa
/// infrastruttura esiste, scritta in forma eseguibile invece che in un commento che invecchia.</para>
///
/// <para>⚠️ <b>Un contrasto smentisce il design, ed è scritto qui perché non vada perduto.</b>
/// <c>design.md</c> §Discovery 4 elenca fra i motivi «l'InMemory non applica i token di
/// concorrenza». Misurato su EF Core 8.0.13, <b>è falso</b> per i token dichiarati con
/// <c>IsConcurrencyToken()</c>: InMemory li confronta e lancia. Restano vere — e da sole bastano —
/// le altre tre: transazioni no-op, indici unici ignorati, <c>ExecuteUpdate</c> non supportata.</para>
///
/// <para>🔴 <b>LIMITE DA CONOSCERE PRIMA DI FIDARSI DI QUESTO VERDE.</b> Sqlite prova la
/// <i>logica delle righe toccate</i> — che è la forma della guardia — ma <b>non</b> il locking di
/// riga di InnoDB. La semantica che conta in produzione (current read e blocco sotto
/// <c>REPEATABLE READ</c>, l'isolamento di default di MySQL) <b>non è riprodotta qui</b> e resta
/// verificabile solo su MySQL vero. In particolare: se una guardia venisse scritta in forma
/// <i>pessimistica</i> (<c>SELECT … FOR UPDATE</c>) invece che ottimistica, questi test non la
/// proverebbero comunque. Un verde qui significa «la guardia c'è ed è della forma giusta», non
/// «due operatori concorrenti su MySQL non possono incassare due volte».</para>
/// </summary>
public class TestDbContextFactorySqliteTests
{
    private static Prodotto CreaProdotto(string codice, string nome = "Prodotto di prova", decimal prezzo = 1.50m)
        => new()
        {
            Codice = codice,
            Nome = nome,
            Prezzo = prezzo,
            Categoria = "TEST",
            AliquotaIva = 22m,
            Attivo = true,
        };

    // ── 1. Lo schema si costruisce ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateSqlite_CostruisceLoSchema_ELoRendeScrivibile()
    {
        // Il punto non è che il metodo ritorni: è che EnsureCreated() abbia emesso la CREATE TABLE
        // senza inciampare nelle default MySQL-only, e che la tabella sia usabile.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();

        using (var contesto = TestDbContextFactory.CreateSqlite(connessione))
        {
            contesto.Prodotti.Add(CreaProdotto("SQL-001"));
            await contesto.SaveChangesAsync();
        }

        // Rilettura da un contesto nuovo: senza questo l'identity map risponderebbe al posto del
        // database, e il test non proverebbe che la riga è stata scritta davvero.
        using var contestoDiLettura = TestDbContextFactory.CreateSqlite(connessione);
        var prodotto = await contestoDiLettura.Prodotti.SingleAsync(p => p.Codice == "SQL-001");

        prodotto.Nome.Should().Be("Prodotto di prova");
        prodotto.Prezzo.Should().Be(1.50m);
    }

    [Fact]
    public void CreateSqlite_SenzaConnessioneEsplicita_SiChiudeDaSola()
    {
        // L'overload di comodo possiede la propria connessione: nessun database :memory: resta
        // appeso quando il test finisce.
        using var contesto = TestDbContextFactory.CreateSqlite();

        contesto.Prodotti.Add(CreaProdotto("SQL-OWN"));
        contesto.SaveChanges();

        contesto.Prodotti.Count().Should().Be(1);
    }

    // ── 2. Indice unico ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateSqlite_ApplicaLIndiceUnicoSulCodiceProdotto()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var contesto = TestDbContextFactory.CreateSqlite(connessione);

        contesto.Prodotti.Add(CreaProdotto("DOPPIO"));
        await contesto.SaveChangesAsync();

        using var secondoContesto = TestDbContextFactory.CreateSqlite(connessione);
        secondoContesto.Prodotti.Add(CreaProdotto("DOPPIO", nome: "Un altro prodotto"));

        var eccezione = await Assert.ThrowsAsync<DbUpdateException>(() => secondoContesto.SaveChangesAsync());
        eccezione.InnerException.Should().BeOfType<SqliteException>();

        // E la riga non c'è: il rifiuto è del database, non un'eccezione decorativa.
        using var contestoDiLettura = TestDbContextFactory.CreateSqlite(connessione);
        (await contestoDiLettura.Prodotti.CountAsync(p => p.Codice == "DOPPIO")).Should().Be(1);
    }

    [Fact]
    public async Task InMemory_NonApplicaLIndiceUnico_EccoPercheServeSqlite()
    {
        // Contrasto: sul provider usato dal resto della suite lo stesso codice duplicato passa
        // liscio. Un test sulla corsa al numero d'ordine scritto su InMemory sarebbe verde
        // qualunque cosa faccia il codice sotto — cioè peggio di non averlo.
        using var contesto = TestDbContextFactory.Create();

        contesto.Prodotti.Add(CreaProdotto("DOPPIO"));
        contesto.Prodotti.Add(CreaProdotto("DOPPIO", nome: "Un altro prodotto"));
        await contesto.SaveChangesAsync();

        (await contesto.Prodotti.CountAsync(p => p.Codice == "DOPPIO")).Should().Be(2);
    }

    // ── 3. Transazioni ───────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreateSqlite_RollbackDiUnaTransazione_NonLasciaTraccia()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();

        using (var contesto = TestDbContextFactory.CreateSqlite(connessione))
        {
            using var transazione = await contesto.Database.BeginTransactionAsync();
            contesto.Prodotti.Add(CreaProdotto("ROLLBACK"));
            await contesto.SaveChangesAsync();
            await transazione.RollbackAsync();
        }

        using var contestoDiLettura = TestDbContextFactory.CreateSqlite(connessione);
        (await contestoDiLettura.Prodotti.CountAsync(p => p.Codice == "ROLLBACK")).Should().Be(0);
    }

    [Fact]
    public async Task InMemory_LaTransazioneEUnNoOp_EccoPercheServeSqlite()
    {
        // Contrasto: su InMemory il rollback non annulla niente — TestDbContextFactory.Create()
        // deve infatti sopprimere InMemoryEventId.TransactionIgnoredWarning. Su questo provider
        // «l'operazione è atomica» non è un'affermazione verificabile.
        using var contesto = TestDbContextFactory.Create();

        using (var transazione = await contesto.Database.BeginTransactionAsync())
        {
            contesto.Prodotti.Add(CreaProdotto("ROLLBACK"));
            await contesto.SaveChangesAsync();
            await transazione.RollbackAsync();
        }

        contesto.ChangeTracker.Clear();
        (await contesto.Prodotti.CountAsync(p => p.Codice == "ROLLBACK")).Should().Be(1);
    }

    // ── 4. UPDATE condizionata e righe toccate ───────────────────────────────────────────────────

    [Fact]
    public async Task CreateSqlite_UpdateCondizionata_ToccaUnaRigaLaPrimaVoltaEZeroLaSeconda()
    {
        // È la forma esatta della guardia di transizione: si scrive condizionando sullo stato
        // atteso e si CONTA quante righe si sono toccate. 1 = la transizione è mia; 0 = qualcun
        // altro è già passato di qui, e non si applica alcun delta.
        // Nota: su InMemory questo test non sarebbe nemmeno scrivibile — ExecuteUpdateAsync non è
        // supportata da quel provider.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var contestoDiSemina = TestDbContextFactory.CreateSqlite(connessione);

        var prodotto = CreaProdotto("GUARDIA");
        contestoDiSemina.Prodotti.Add(prodotto);
        await contestoDiSemina.SaveChangesAsync();
        var id = prodotto.ProdottoId;

        using var primoScrittore = TestDbContextFactory.CreateSqlite(connessione);
        var righeToccateDalPrimo = await primoScrittore.Prodotti
            .Where(p => p.ProdottoId == id && p.Attivo)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Attivo, false));

        using var secondoScrittore = TestDbContextFactory.CreateSqlite(connessione);
        var righeToccateDalSecondo = await secondoScrittore.Prodotti
            .Where(p => p.ProdottoId == id && p.Attivo)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Attivo, false));

        righeToccateDalPrimo.Should().Be(1, "la prima transizione trova lo stato atteso");
        righeToccateDalSecondo.Should().Be(0, "la seconda non trova più nulla da transire, e deve accorgersene");
    }

    // ── 5. Token di concorrenza ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Sqlite_OnoraIlTokenDiConcorrenza_IlSecondoScrittoreVieneRifiutato()
    {
        // ⚠️ AGGIORNATO IN FASE 5: il token del modello di produzione NON è un `Ordine.RowVersion`
        // — quella colonna non esiste e non può esistere, perché né MySQL né Sqlite la
        // popolerebbero da soli — ma `Ordine.Stato` con IsConcurrencyToken(). Qui resta il modello
        // minimo di prova, perché ciò che questo test deve dimostrare è la CAPACITÀ DEL PROVIDER,
        // non la guardia vera: quella è pinnata da OrdiniChiusuraTests e OrdiniTransizioniTests.
        //
        // Lo scenario è quello vero: due operatori leggono lo stesso ordine APERTO, il primo lo
        // chiude, il secondo prova a chiuderlo di nuovo con in mano un valore ormai vecchio.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();

        using (var contestoDiSemina = ContestoConToken.Sqlite(connessione))
        {
            await contestoDiSemina.Database.EnsureCreatedAsync();
            contestoDiSemina.Righe.Add(new RigaConToken { Stato = "APERTO" });
            await contestoDiSemina.SaveChangesAsync();
        }

        using var primoOperatore = ContestoConToken.Sqlite(connessione);
        using var secondoOperatore = ContestoConToken.Sqlite(connessione);

        var rigaDelPrimo = await primoOperatore.Righe.SingleAsync();
        var rigaDelSecondo = await secondoOperatore.Righe.SingleAsync();

        rigaDelPrimo.Stato = "CHIUSO";
        await primoOperatore.SaveChangesAsync();

        // Il secondo ha ancora "APERTO" come valore originale: la UPDATE porta
        // `WHERE Id = … AND Stato = 'APERTO'`, non tocca alcuna riga, ed EF lo trasforma in
        // eccezione invece di lasciar passare una scrittura muta.
        rigaDelSecondo.Stato = "CHIUSO";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => secondoOperatore.SaveChangesAsync());

        using var contestoDiLettura = ContestoConToken.Sqlite(connessione);
        (await contestoDiLettura.Righe.SingleAsync()).Stato.Should().Be("CHIUSO");
    }

    [Fact]
    public async Task InMemory_OnoraIlTokenDiConcorrenzaEsplicito_ContrariamenteAQuantoDiceIlDesign()
    {
        // 🔴 SMENTITA MISURATA, non un'opinione. `design.md` §Discovery 4 e `tasks.md` 2.1
        // affermano che «l'InMemory non applica i token di concorrenza». Su EF Core 8.0.13 è
        // FALSO per i token dichiarati esplicitamente con IsConcurrencyToken(): il provider
        // InMemory li confronta in InMemoryTable.Update e lancia DbUpdateConcurrencyException
        // esattamente come Sqlite. Questo test è scritto per fissare il fatto: se lo si toglie,
        // qualcuno riprenderà l'affermazione dal design come se fosse verificata.
        //
        // ⚠️ La conclusione NON è «Sqlite non serviva». Le tre ragioni che restano in piedi sono
        // quelle provate sopra e sono da sole sufficienti:
        //   • le transazioni su InMemory sono no-op (RollbackDiUnaTransazione / LaTransazioneEUnNoOp);
        //   • gli indici unici non sono applicati (ApplicaLIndiceUnico / NonApplicaLIndiceUnico);
        //   • ExecuteUpdateAsync — la forma stessa della guardia, con il conteggio delle righe
        //     toccate — non è nemmeno supportata (vedi il test qui sotto).
        // Cambia la MOTIVAZIONE della fase, non la sua necessità.
        using var contestoDiSemina = ContestoConToken.InMemory(out var nomeDatabase);
        contestoDiSemina.Righe.Add(new RigaConToken { Stato = "APERTO" });
        await contestoDiSemina.SaveChangesAsync();

        using var primoOperatore = ContestoConToken.InMemory(nomeDatabase);
        using var secondoOperatore = ContestoConToken.InMemory(nomeDatabase);

        var rigaDelPrimo = await primoOperatore.Righe.SingleAsync();
        var rigaDelSecondo = await secondoOperatore.Righe.SingleAsync();

        rigaDelPrimo.Stato = "CHIUSO";
        await primoOperatore.SaveChangesAsync();

        rigaDelSecondo.Stato = "ANNULLATO";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => secondoOperatore.SaveChangesAsync());

        using var contestoDiLettura = ContestoConToken.InMemory(nomeDatabase);
        (await contestoDiLettura.Righe.SingleAsync()).Stato.Should().Be("CHIUSO");
    }

    [Fact]
    public async Task InMemory_NonSupportaExecuteUpdate_EccoPercheServeSqlite()
    {
        // La guardia di transizione conta le righe toccate da una UPDATE condizionata. Su InMemory
        // quella chiamata non restituisce «0 righe»: non è proprio eseguibile. È la ragione più
        // secca per cui questa fase esiste — il test corrispondente non si potrebbe nemmeno
        // scrivere sul provider che regge il resto della suite.
        using var contesto = TestDbContextFactory.Create();

        contesto.Prodotti.Add(CreaProdotto("GUARDIA"));
        await contesto.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => contesto.Prodotti
            .Where(p => p.Attivo)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Attivo, false)));
    }

    /// <summary>
    /// Riga di prova con un token di concorrenza sullo stato — la forma che avrà
    /// <c>Ordine</c> quando la fase 3 di questo change atterrerà.
    /// </summary>
    private sealed class RigaConToken
    {
        public int Id { get; set; }
        public string Stato { get; set; } = string.Empty;
    }

    /// <summary>
    /// Modello minimo di prova, indipendente da <c>AppDbContext</c>: serve solo a verificare che il
    /// provider applichi il token di concorrenza, e non deve inventare entità di produzione che
    /// questo change non ha ancora creato.
    /// </summary>
    private sealed class ContestoConToken : DbContext
    {
        public ContestoConToken(DbContextOptions<ContestoConToken> options) : base(options)
        {
        }

        public DbSet<RigaConToken> Righe => Set<RigaConToken>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
            => modelBuilder.Entity<RigaConToken>().Property(r => r.Stato).IsConcurrencyToken();

        public static ContestoConToken Sqlite(SqliteConnection connessione)
            => new(new DbContextOptionsBuilder<ContestoConToken>().UseSqlite(connessione).Options);

        public static ContestoConToken InMemory(string nomeDatabase)
            => new(new DbContextOptionsBuilder<ContestoConToken>()
                .UseInMemoryDatabase(nomeDatabase)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);

        public static ContestoConToken InMemory(out string nomeDatabase)
        {
            nomeDatabase = Guid.NewGuid().ToString();
            return InMemory(nomeDatabase);
        }
    }
}
