using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using duedgusto.Models;
using duedgusto.SeedData;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// La voce «Ordini», sorella di «Vendita» al primo livello, e la rinumerazione che ha richiesto.
///
/// <para>🔴 <b>Il caso che conta davvero è l'ultimo: nessuna posizione duplicata.</b> Inserire una
/// voce in mezzo a una numerazione senza buchi obbliga a spostare tutte quelle sotto, e il guasto
/// di una rinumerazione fatta a metà <b>non dà errore</b>: due voci a pari posizione si ordinano
/// per Id, perché <c>AuthenticationDataLoaders</c> fa <c>OrderBy(m =&gt; m.Posizione)</c> senza
/// tie-break. La barra si presenterebbe in un ordine che nessuno ha scelto, diverso da un
/// database all'altro a seconda di quando ciascuna voce è stata creata — e in locale sembrerebbe
/// giusto proprio dove il seed le ha create in ordine.</para>
///
/// <para>⚠️ I riscontri leggono <c>MenuPadreId</c> da un contesto <b>nuovo</b>, mai la navigazione
/// <c>MenuPadre</c> dell'entità tracciata: è la stessa cautela di
/// <see cref="SeedMenusVenditaTests"/>, e la ragione è lì per esteso.</para>
/// </summary>
public class SeedMenusOrdiniTests
{
    private const string PercorsoOrdini = "/gestionale/cassa/ordini";

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

    private static void CreaRuoli(AppDbContext dbContext)
    {
        dbContext.Ruoli.Add(new Ruolo { Nome = "SuperAdmin", Descrizione = "Amministratore di sistema", Amministratore = true });
        dbContext.Ruoli.Add(new Ruolo { Nome = "Cassiere", Descrizione = "Personale di sala" });
    }

    /// <summary>
    /// Tutti i seeder dei menu, nell'ordine in cui <c>Program.cs</c> li chiama.
    ///
    /// <para>⚠️ Se qui ne mancasse uno, l'ultimo test misurerebbe una barra parziale e la
    /// collisione che sta cercando potrebbe stare proprio nella voce assente.</para>
    /// </summary>
    private static async Task SeminaTuttiIMenu(ServiceProvider provider)
    {
        await SeedMenus.Initialize(provider);
        await SeedMenusProdotti.Initialize(provider);
        await SeedMenusVendita.Initialize(provider);
        await SeedMenusOrdini.Initialize(provider);
        await SeedMenusSito.Initialize(provider);
    }

    // ── La voce ──────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task LaVoceOrdini_NasceAlPrimoLivello_SubitoDopoVendita()
    {
        string database = Guid.NewGuid().ToString();
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusOrdini.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu ordini = verifica.Menus.Single(m => m.Percorso == PercorsoOrdini);

        ordini.MenuPadreId.Should().BeNull("«Ordini» è sorella di «Vendita», non figlia di un contenitore");
        ordini.Posizione.Should().Be(1, "sta subito sotto «Vendita», che resta a 0");
        ordini.Titolo.Should().Be("Ordini");
        ordini.NomeVista.Should().Be("Ordini");
        ordini.PercorsoFile.Should().Be("vendite/Ordini.tsx");
        ordini.Visibile.Should().BeTrue();
    }

    [Fact]
    public async Task LaVoceOrdini_VaATuttiIRuoli_NonAlSoloSuperAdmin()
    {
        // Guardare gli ordini aperti non è un'operazione amministrativa: è ciò che si fa dietro
        // il bancone, con lo stesso criterio già scelto per «Vendita».
        string database = Guid.NewGuid().ToString();
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusOrdini.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu ordini = verifica.Menus.Include(m => m.Ruoli).Single(m => m.Percorso == PercorsoOrdini);

        ordini.Ruoli.Select(r => r.Nome).Should().BeEquivalentTo("SuperAdmin", "Cassiere");
    }

    [Fact]
    public async Task IlSeed_EIdempotente_ENonDuplicaLaVoce()
    {
        // Il seeder gira a ogni avvio: la seconda esecuzione deve trovare la voce e lasciarla
        // dov'è, non affiancarle un gemello con lo stesso percorso.
        string database = Guid.NewGuid().ToString();
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusOrdini.Initialize(BuildProvider(database));
        await SeedMenusOrdini.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        verifica.Menus.Count(m => m.Percorso == PercorsoOrdini).Should().Be(1);
    }

    [Fact]
    public async Task UnaVoceRimastaAllaVecchiaPosizione_VieneRiallineata()
    {
        // 🔴 Il ramo che conta su un database già esistente. Senza, la rinumerazione varrebbe
        //    solo per le installazioni nuove e in produzione la barra resterebbe com'era.
        string database = Guid.NewGuid().ToString();
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
            seme.Menus.Add(new Menu
            {
                Titolo = "Ordini",
                Percorso = PercorsoOrdini,
                Icona = "List",
                Visibile = true,
                Posizione = 7,
                NomeVista = "Ordini",
                PercorsoFile = "vendite/Ordini.tsx",
                MenuPadreId = null
            });
            await seme.SaveChangesAsync();
        }

        await SeedMenusOrdini.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu ordini = verifica.Menus.Single(m => m.Percorso == PercorsoOrdini);
        ordini.Posizione.Should().Be(1);
        ordini.Icona.Should().Be("ConciergeBell");
    }

    // ── La rinumerazione ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task LeVociDiPrimoLivello_NonCondividonoUnaPosizione()
    {
        // 🔴 IL test di questa fase. Inserire «Ordini» in posizione 1 ha spostato di uno tutte le
        //    voci sotto, in tre file diversi e su due rami ciascuna (creazione e allineamento).
        //    Dimenticarne uno non produce alcun errore: produce due voci a pari posizione, che
        //    `AuthenticationDataLoaders` ordina per Id perché il suo OrderBy non ha tie-break.
        string database = Guid.NewGuid().ToString();
        ServiceProvider provider = BuildProvider(database);
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeminaTuttiIMenu(provider);

        using AppDbContext verifica = CreaContesto(database);
        List<Menu> primoLivello = verifica.Menus.Where(m => m.MenuPadreId == null).ToList();

        primoLivello.Select(m => m.Posizione).Should().OnlyHaveUniqueItems(
            "due voci a pari posizione si ordinerebbero per Id, cioè per l'ordine in cui il seed le ha create: "
            + "un criterio che nessuno ha scelto e che cambia da un database all'altro");
    }

    [Fact]
    public async Task VenditaEOrdini_ApronoLaBarra_NellOrdineGiusto()
    {
        // Le due voci del bancone stanno in cima, e in quest'ordine: prima si batte, poi si
        // guarda cosa resta aperto.
        string database = Guid.NewGuid().ToString();
        ServiceProvider provider = BuildProvider(database);
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeminaTuttiIMenu(provider);

        using AppDbContext verifica = CreaContesto(database);
        List<string> titoli = verifica.Menus
            .Where(m => m.MenuPadreId == null)
            .OrderBy(m => m.Posizione)
            .Select(m => m.Titolo)
            .ToList();

        titoli.Take(2).Should().Equal("Vendita", "Ordini");
        // ⚠️ E le altre non si sono perse per strada nella rinumerazione.
        titoli.Should().Contain(["Dashboard", "Cassa", "Fornitori", "Utenti", "Ruoli", "Menù", "Impostazioni", "Wiki", "Sito"]);
    }

    [Fact]
    public async Task SeminareDueVolte_NonSpostaNulla()
    {
        // Il riavvio successivo è il caso normale: il secondo giro deve trovare tutto allineato
        // e non riordinare niente. Un seed che oscilla fra due disposizioni sposterebbe la barra
        // sotto le mani a ogni deploy.
        string database = Guid.NewGuid().ToString();
        ServiceProvider provider = BuildProvider(database);
        using (AppDbContext seme = CreaContesto(database))
        {
            CreaRuoli(seme);
            await seme.SaveChangesAsync();
        }

        await SeminaTuttiIMenu(provider);
        Dictionary<string, int> primoGiro;
        using (AppDbContext lettura = CreaContesto(database))
        {
            primoGiro = lettura.Menus.Where(m => m.MenuPadreId == null).ToDictionary(m => m.Titolo, m => m.Posizione);
        }

        await SeminaTuttiIMenu(provider);

        using AppDbContext verifica = CreaContesto(database);
        verifica.Menus.Where(m => m.MenuPadreId == null).ToDictionary(m => m.Titolo, m => m.Posizione)
            .Should().BeEquivalentTo(primoGiro);
    }
}
