using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using duedgusto.SeedData;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// Il seed delle impostazioni della vetrina <b>crea e non aggiorna</b>.
///
/// <para>🔴 La differenza con <c>SeedMenus</c> è la sostanza del test, non un dettaglio: il
/// seed gira a ogni avvio, e un menu riallineato è desiderabile mentre un indirizzo riscritto
/// è perdita di lavoro dell'amministratore. Il guasto che questi test prevengono è silenzioso
/// — nessun errore, nessun log, solo un dato dell'utente che torna al valore di fabbrica dopo
/// un riavvio che nessuno collega alla cosa.</para>
///
/// <para>⚠️ Il <c>ServiceProvider</c> registra il contesto come <b>factory</b> e non come
/// istanza singola: <c>Initialize</c> crea e dispone il proprio scope, quindi condividere una
/// sola istanza farebbe fallire il secondo giro con <c>ObjectDisposedException</c>. In
/// produzione ogni avvio ha un contesto nuovo, ed è quello che va simulato.</para>
/// </summary>
public class SeedImpostazioniVetrinaTests
{
    /// <summary>
    /// Provider con un contesto <b>nuovo per scope</b>, tutti sullo stesso database InMemory:
    /// è la forma che riproduce tre avvii consecutivi dell'applicazione.
    /// </summary>
    private static ServiceProvider BuildProvider(string nomeDatabase)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped(_ => CreaContesto(nomeDatabase));
        return services.BuildServiceProvider();
    }

    private static AppDbContext CreaContesto(string nomeDatabase)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(nomeDatabase)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var configMock = new Mock<IConfiguration>();
        var connectionStringsSection = new Mock<IConfigurationSection>();
        connectionStringsSection.Setup(s => s[It.IsAny<string>()]).Returns("Server=test;Database=test");
        configMock.Setup(c => c.GetSection("ConnectionStrings")).Returns(connectionStringsSection.Object);

        return new AppDbContext(options, configMock.Object);
    }

    [Fact]
    public async Task PrimoAvvioSuDatabaseVuoto_CreaLaRigaConIDatiRealiDelLocale()
    {
        string database = Guid.NewGuid().ToString();
        await SeedImpostazioniVetrina.Initialize(BuildProvider(database));

        using AppDbContext dbContext = CreaContesto(database);
        ImpostazioniVetrina riga = dbContext.ImpostazioniVetrina.Single();

        riga.ImpostazioniVetrinaId.Should().Be(ImpostazioniVetrina.IdSingleton);
        riga.InsegnaPubblica.Should().Be("2D Gusto Bar");
        riga.Via.Should().Be("Via del Costo 99");
        riga.Cap.Should().Be("36016");
        riga.Citta.Should().Be("Thiene");
        riga.Provincia.Should().Be("VI");
        riga.UrlInstagram.Should().Be("https://www.instagram.com/2dgusto/");
    }

    /// <summary>
    /// L'insegna pubblica è <b>distinta</b> dal nome del gestionale: sono due nomi con due
    /// pubblici, e il giorno in cui coincidessero uno dei due comparirebbe nel posto sbagliato.
    /// </summary>
    [Fact]
    public async Task LInsegnaPubblica_ENonEIlNomeDelGestionale()
    {
        string database = Guid.NewGuid().ToString();
        await SeedImpostazioniVetrina.Initialize(BuildProvider(database));

        using AppDbContext dbContext = CreaContesto(database);
        dbContext.ImpostazioniVetrina.Single().InsegnaPubblica
            .Should().NotBe("DuedGusto").And.NotBe("duedgusto");
    }

    /// <summary>
    /// Il modello non possiede orari: se una proprietà di orario comparisse qui, gli orari
    /// avrebbero due sorgenti e il sito potrebbe dire una cosa diversa dalla cassa.
    /// </summary>
    [Fact]
    public void IlModello_NonPossiedeAlcunCampoDiOrario()
    {
        string[] proprieta = typeof(ImpostazioniVetrina).GetProperties().Select(p => p.Name).ToArray();

        proprieta.Should().NotContain(nome =>
            nome.Contains("Apertura", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Chiusura", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Opening", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Closing", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("GiorniOperativi", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("OperatingDays", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("Timezone", StringComparison.OrdinalIgnoreCase)
            || nome.Contains("FusoOrario", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task TreAvviiConsecutivi_LascianoUnaRigaSola()
    {
        string database = Guid.NewGuid().ToString();

        foreach (int _ in Enumerable.Range(1, 3))
        {
            await SeedImpostazioniVetrina.Initialize(BuildProvider(database));
        }

        using AppDbContext dbContext = CreaContesto(database);
        dbContext.ImpostazioniVetrina.Should().HaveCount(1);
    }

    /// <summary>
    /// 🔴 Il test che descrive il motivo per cui il seed non ha un ramo di aggiornamento: i
    /// valori che l'amministratore ha cambiato a mano sono ancora i suoi dopo tre riavvii.
    /// Aggiungere un <c>UpdateIfNeeded</c> lo fa diventare rosso, ed è esattamente ciò che
    /// deve succedere.
    /// </summary>
    [Fact]
    public async Task TreAvviiConsecutivi_NonSovrascrivonoIlLavoroDellAmministratore()
    {
        string database = Guid.NewGuid().ToString();
        await SeedImpostazioniVetrina.Initialize(BuildProvider(database));

        using (AppDbContext modifica = CreaContesto(database))
        {
            ImpostazioniVetrina riga = modifica.ImpostazioniVetrina.Single();
            riga.Via = "Corso Garibaldi 12";
            riga.Citta = "Schio";
            riga.UrlInstagram = "https://www.instagram.com/scelto-a-mano/";
            riga.Telefono = "0445 123456";
            await modifica.SaveChangesAsync();
        }

        foreach (int _ in Enumerable.Range(1, 3))
        {
            await SeedImpostazioniVetrina.Initialize(BuildProvider(database));
        }

        using AppDbContext lettura = CreaContesto(database);
        ImpostazioniVetrina dopo = lettura.ImpostazioniVetrina.Single();

        dopo.Via.Should().Be("Corso Garibaldi 12");
        dopo.Citta.Should().Be("Schio");
        dopo.UrlInstagram.Should().Be("https://www.instagram.com/scelto-a-mano/");
        dopo.Telefono.Should().Be("0445 123456");
        // E l'insegna NON è tornata al valore di fabbrica insieme al resto.
        dopo.InsegnaPubblica.Should().Be("2D Gusto Bar");
    }

    /// <summary>
    /// Anche una riga completamente diversa da quella del seed resta intatta: la condizione è
    /// «esiste una riga», non «esiste una riga che assomiglia a quella che scriverei io».
    /// </summary>
    [Fact]
    public async Task ConUnaRigaGiaValorizzataDiversamente_IlSeedNonCambiaNulla()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext preesistente = CreaContesto(database))
        {
            preesistente.ImpostazioniVetrina.Add(new ImpostazioniVetrina
            {
                ImpostazioniVetrinaId = ImpostazioniVetrina.IdSingleton,
                InsegnaPubblica = "Altro Locale",
                Via = "Via Altrove 1",
                Cap = "00100",
                Citta = "Roma",
                Provincia = "RM",
                OraInizioTemaSera = "20:30",
            });
            await preesistente.SaveChangesAsync();
        }

        await SeedImpostazioniVetrina.Initialize(BuildProvider(database));

        using AppDbContext lettura = CreaContesto(database);
        ImpostazioniVetrina riga = lettura.ImpostazioniVetrina.Single();
        riga.InsegnaPubblica.Should().Be("Altro Locale");
        riga.Citta.Should().Be("Roma");
        riga.OraInizioTemaSera.Should().Be("20:30");
    }

    /// <summary>
    /// ⚠️ I default significativi vivono nel <b>modello</b> e non solo nel seed: il seed salta
    /// quando la riga esiste, quindi una colonna aggiunta in futuro non riceverebbe mai il suo
    /// valore sulle installazioni già avviate. Questo test pinna i quattro che contano.
    /// </summary>
    [Fact]
    public void IDefaultSignificativi_SonoDichiaratiNelModello()
    {
        var appena = new ImpostazioniVetrina();

        appena.Paese.Should().Be("IT");
        appena.OraInizioTemaSera.Should().Be("18:00");
        appena.PrenotazioniPreavvisoOre.Should().Be(2);
        appena.PrenotazioniCopertiMax.Should().Be(20);
        appena.PrenotazioniAttive.Should().BeFalse("i ganci delle fasi successive nascono spenti");
        appena.ImpostazioniVetrinaId.Should().Be(ImpostazioniVetrina.IdSingleton);
    }

    /// <summary>
    /// Gli stessi default sono dichiarati anche nel <b>database</b>, non solo nel CLR: è ciò
    /// che li fa arrivare a una riga già esistente quando la colonna nasce dopo di lei.
    /// </summary>
    [Fact]
    public void IDefaultSignificativi_SonoDichiaratiAncheNelloSchema()
    {
        using AppDbContext dbContext = CreaContesto(Guid.NewGuid().ToString());
        Microsoft.EntityFrameworkCore.Metadata.IEntityType entita =
            dbContext.Model.FindEntityType(typeof(ImpostazioniVetrina))!;

        entita.FindProperty(nameof(ImpostazioniVetrina.Paese))!.GetDefaultValue().Should().Be("IT");
        entita.FindProperty(nameof(ImpostazioniVetrina.OraInizioTemaSera))!.GetDefaultValue().Should().Be("18:00");
        entita.FindProperty(nameof(ImpostazioniVetrina.PrenotazioniPreavvisoOre))!.GetDefaultValue().Should().Be(2);
        entita.FindProperty(nameof(ImpostazioniVetrina.PrenotazioniCopertiMax))!.GetDefaultValue().Should().Be(20);
    }

    /// <summary>
    /// 🔴 L'identificativo non è generato dal database: con l'auto-increment un <c>INSERT</c>
    /// senza id creerebbe la riga 2 <b>in silenzio</b>, e il <c>CHECK</c> non avrebbe nulla da
    /// impedire perché nessuno avrebbe dichiarato l'intenzione sbagliata.
    /// </summary>
    [Fact]
    public void LIdentificativo_NonEGeneratoDalDatabase_EIlSingletonEVincolato()
    {
        // ⚠️ Due trappole in una riga. Il vincolo CHECK è metadato RELAZIONALE, quindi serve il
        //    provider MySQL e non InMemory; e non vive nel modello di runtime, che EF
        //    ottimizza per la lettura scartando ciò che serve solo alle migrazioni — va letto
        //    dal modello di DESIGN-TIME. Né UseMySql con versione esplicita né la lettura del
        //    modello aprono una connessione, quindi il test non richiede alcun MySQL attivo.
        using AppDbContext dbContext = ContestoRelazionaleSenzaConnessione();
        Microsoft.EntityFrameworkCore.Metadata.IEntityType entita = dbContext
            .GetService<Microsoft.EntityFrameworkCore.Metadata.IDesignTimeModel>()
            .Model.FindEntityType(typeof(ImpostazioniVetrina))!;

        entita.FindProperty(nameof(ImpostazioniVetrina.ImpostazioniVetrinaId))!
            .ValueGenerated.Should().Be(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never);

        // ⚠️ Si asserisce l'INSIEME e non «uno solo»: i CHECK di questa tabella sono due, e
        //    l'uguaglianza è ciò che rende rosso sia un vincolo perso sia uno aggiunto di
        //    nascosto. Un `Contain` sul solo singleton resterebbe verde perdendo l'altro.
        entita.GetCheckConstraints().Select(vincolo => vincolo.Name).Should().BeEquivalentTo(
            ["CK_ImpostazioniVetrina_Singleton", "CK_ImpostazioniVetrina_PiattoGiorno"]);
    }

    /// <summary>
    /// Contesto sul provider MySQL reale, usato solo per <b>leggere il modello</b>: la versione
    /// del server è fissa (come a design-time in <c>Program.cs</c>) perché <c>AutoDetect</c>
    /// aprirebbe una connessione.
    /// </summary>
    private static AppDbContext ContestoRelazionaleSenzaConnessione()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("server=nessuno;database=nessuno;user=nessuno;password=nessuno",
                new MySqlServerVersion(new Version(8, 0, 32)))
            .Options;

        var configMock = new Mock<IConfiguration>();
        return new AppDbContext(options, configMock.Object);
    }

    /// <summary>
    /// ⚠️ La relazione verso il media dell'anteprima social <b>non ha navigazione inversa</b>:
    /// <c>MediaAsset</c> ha già <c>ICollection&lt;Prodotto&gt; Prodotti</c>, e senza un
    /// <c>WithMany()</c> esplicito EF potrebbe riusare quella collezione o creare una FK ombra
    /// — producendo una colonna su una tabella che questa change ha promesso di non toccare.
    /// </summary>
    [Fact]
    public void LaRelazioneVersoIlMedia_NonHaNavigazioneInversaEdERestrittiva()
    {
        using AppDbContext dbContext = CreaContesto(Guid.NewGuid().ToString());
        Microsoft.EntityFrameworkCore.Metadata.IEntityType entita =
            dbContext.Model.FindEntityType(typeof(ImpostazioniVetrina))!;

        Microsoft.EntityFrameworkCore.Metadata.INavigation navigazione =
            entita.FindNavigation(nameof(ImpostazioniVetrina.ImmagineOg))!;

        navigazione.ForeignKey.DeleteBehavior.Should().Be(DeleteBehavior.Restrict);
        navigazione.ForeignKey.PrincipalToDependent.Should().BeNull(
            "una navigazione inversa su MediaAsset sarebbe la collezione che nessuno ha chiesto");

        // E MediaAsset conserva la sola collezione preesistente verso i prodotti.
        dbContext.Model.FindEntityType(typeof(MediaAsset))!.GetNavigations()
            .Select(n => n.Name).Should().BeEquivalentTo([nameof(MediaAsset.Prodotti)]);
    }
}
