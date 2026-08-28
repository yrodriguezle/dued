using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

using duedgusto.SeedData;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// La voce «Vendita» è di <b>primo livello</b>: il seed la promuove da sotto «Cassa» e ce la
/// tiene, riavvio dopo riavvio.
///
/// <para>🔴 <b>Ogni riscontro avviene su un <see cref="AppDbContext"/> nuovo e guarda
/// <c>MenuPadreId</c>, mai la navigazione <c>MenuPadre</c>.</b> Non è pignoleria: il guasto che
/// questi test sorvegliano è fatto apposta per essere invisibile. <c>UpdateMenuIfNeeded</c>
/// spostava il padre assegnando la <i>navigazione</i> (<c>menu.MenuPadre = menuPadre</c>) mentre
/// la query del seeder fa <c>.Include(m =&gt; m.Ruoli)</c> e non carica <c>MenuPadre</c>: la
/// navigazione vale già <c>null</c> in memoria, assegnarle <c>null</c> non è una modifica per il
/// change tracker, e <c>MenuPadreId</c> resta agganciato a «Cassa». Un test che leggesse la
/// navigazione dell'entità tracciata la troverebbe <c>null</c> e sarebbe verde <b>anche con il
/// difetto dentro</b> — verde per l'assenza di un caricamento, non per l'avvenuta promozione.
/// La coppia «contesto nuovo + chiave esterna» toglie di mezzo entrambi gli inganni.</para>
///
/// <para>⚠️ Il <c>ServiceProvider</c> registra il contesto come <b>factory di scope</b> e non
/// come istanza singola: <c>Initialize</c> apre e dispone il proprio scope, quindi condividere
/// una sola istanza farebbe fallire il secondo giro con <c>ObjectDisposedException</c>. In
/// produzione ogni avvio ha un contesto nuovo, ed è quello che qui si riproduce.</para>
///
/// <para>ℹ️ InMemory basta per tutta la fase: nessuna transazione, nessun token di concorrenza,
/// nessun indice unico in gioco. Il change tracking — l'unica cosa che questi test misurano — è
/// indipendente dal provider.</para>
/// </summary>
public class SeedMenusVenditaTests
{
    private const string PercorsoVendita = "/gestionale/cassa/vendita";

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

    /// <summary>Il ruolo senza il quale <c>SeedMenusVendita</c> esce subito.</summary>
    private static Ruolo CreaSuperAdmin(AppDbContext dbContext)
    {
        var superAdmin = new Ruolo { Nome = "SuperAdmin", Descrizione = "Amministratore di sistema", Amministratore = true };
        dbContext.Ruoli.Add(superAdmin);
        return superAdmin;
    }

    private static Menu CreaCassa(AppDbContext dbContext) =>
        AggiungiMenu(dbContext, new Menu
        {
            Titolo = "Cassa",
            Percorso = string.Empty,
            Icona = "Wallet",
            Visibile = true,
            Posizione = 2,
            NomeVista = string.Empty,
            PercorsoFile = string.Empty,
            MenuPadreId = null
        });

    private static Menu AggiungiMenu(AppDbContext dbContext, Menu menu)
    {
        dbContext.Menus.Add(menu);
        return menu;
    }

    // ────────────────────────────────────────────────────────────────────────────────────────
    // 1.4 — la regressione del padre: la FK deve azzerarsi DAVVERO
    // ────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// 🔴 Il test che deve essere <b>rosso</b> finché <c>UpdateMenuIfNeeded</c> assegna la
    /// navigazione invece della chiave esterna. La voce parte annidata sotto «Cassa», come sta
    /// oggi in ogni database esistente; dopo il seed la si rilegge da un contesto nuovo, che è
    /// l'equivalente del riavvio successivo.
    /// </summary>
    [Fact]
    public async Task VoceGiaAnnidataSottoCassa_DopoIlSeedHaMenuPadreIdNulloNelDatabase()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            Menu cassa = CreaCassa(seme);
            await seme.SaveChangesAsync();

            AggiungiMenu(seme, new Menu
            {
                Titolo = "Vendita",
                Percorso = PercorsoVendita,
                Icona = "ShoppingCart",
                Visibile = true,
                Posizione = 1,
                NomeVista = "PuntoVendita",
                PercorsoFile = "vendite/PuntoVendita.tsx",
                MenuPadreId = cassa.Id
            });
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        // 🔴 Contesto NUOVO: la identity map del contesto del seeder maschererebbe il no-op.
        using AppDbContext verifica = CreaContesto(database);
        Menu vendita = verifica.Menus.Single(m => m.Percorso == PercorsoVendita);

        vendita.MenuPadreId.Should().BeNull(
            "la voce «Vendita» è di primo livello: la FK verso «Cassa» deve azzerarsi sul database, non solo sull'entità tracciata");
        vendita.Posizione.Should().Be(0);
    }

    /// <summary>
    /// «Cassa» non viene toccata dalla promozione: esiste ancora e conserva gli altri figli.
    /// </summary>
    [Fact]
    public async Task LaPromozione_NonPortaViaGliAltriFigliDiCassa()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            Menu cassa = CreaCassa(seme);
            await seme.SaveChangesAsync();

            AggiungiMenu(seme, new Menu
            {
                Titolo = "Vendita",
                Percorso = PercorsoVendita,
                Icona = "ShoppingCart",
                Visibile = true,
                Posizione = 1,
                NomeVista = "PuntoVendita",
                PercorsoFile = "vendite/PuntoVendita.tsx",
                MenuPadreId = cassa.Id
            });
            AggiungiMenu(seme, new Menu
            {
                Titolo = "Prodotti",
                Percorso = "/gestionale/cassa/prodotti",
                Icona = "Package",
                Visibile = true,
                Posizione = 6,
                NomeVista = "ProdottiList",
                PercorsoFile = "prodotti/ProdottiList.tsx",
                MenuPadreId = cassa.Id
            });
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu cassaDopo = verifica.Menus.Single(m => m.Titolo == "Cassa" && m.Percorso == string.Empty);
        Menu prodotti = verifica.Menus.Single(m => m.Percorso == "/gestionale/cassa/prodotti");

        prodotti.MenuPadreId.Should().Be(cassaDopo.Id);
        prodotti.Posizione.Should().Be(6);
    }

    // ────────────────────────────────────────────────────────────────────────────────────────
    // 1.5 caso B — senza «Cassa» la voce nasce lo stesso
    // ────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// 🔴 Una voce di <b>primo livello non ha padre</b>: cercare «Cassa» e uscire se manca era
    /// un secondo fallimento silenzioso — su un database in cui quella voce fosse stata
    /// rinominata o rimossa, «Vendita» non sarebbe mai nata.
    /// </summary>
    [Fact]
    public async Task DatabaseSenzaIlMenuCassa_CreaComunqueLaVoceVendita()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu vendita = verifica.Menus.Single(m => m.Percorso == PercorsoVendita);

        vendita.Titolo.Should().Be("Vendita");
        vendita.MenuPadreId.Should().BeNull();
        vendita.Posizione.Should().Be(0);
        vendita.Icona.Should().Be("ShoppingCart");
        vendita.NomeVista.Should().Be("PuntoVendita");
        vendita.PercorsoFile.Should().Be("vendite/PuntoVendita.tsx");
        vendita.Visibile.Should().BeTrue();
    }

    // ────────────────────────────────────────────────────────────────────────────────────────
    // 1.5 caso C — il primo livello resta ordinato, e «Vendita» è la prima
    // ────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// <c>AuthenticationDataLoaders</c> ordina con <c>OrderBy(m =&gt; m.Posizione)</c> e
    /// <b>senza tie-break</b>: a parità con Dashboard (che occupa già la 1) l'ordine sarebbe
    /// deciso dall'Id, cioè dal caso. La 0 è l'unico posto libero sopra.
    /// </summary>
    [Fact]
    public async Task NelPrimoLivello_SoloVenditaHaPosizioneZeroEdELaPrima()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            await seme.SaveChangesAsync();
        }

        ServiceProvider provider = BuildProvider(database);
        await SeedMenus.Initialize(provider);
        await SeedMenusVendita.Initialize(provider);

        using AppDbContext verifica = CreaContesto(database);
        List<Menu> primoLivello = [.. verifica.Menus.Where(m => m.MenuPadreId == null)];

        primoLivello.Should().Contain(m => m.Percorso == PercorsoVendita);
        primoLivello.Where(m => m.Posizione == 0).Should().ContainSingle()
            .Which.Percorso.Should().Be(PercorsoVendita);
        primoLivello.OrderBy(m => m.Posizione).First().Percorso.Should().Be(PercorsoVendita);
    }

    // ────────────────────────────────────────────────────────────────────────────────────────
    // Idempotenza
    // ────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task TreAvviiConsecutivi_LascianoUnaSolaVoceAlPrimoLivello()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            CreaCassa(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));
        await SeedMenusVendita.Initialize(BuildProvider(database));
        await SeedMenusVendita.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu vendita = verifica.Menus.Should().ContainSingle(m => m.Percorso == PercorsoVendita).Subject;

        vendita.MenuPadreId.Should().BeNull();
        vendita.Posizione.Should().Be(0);
    }

    // ────────────────────────────────────────────────────────────────────────────────────────
    // 1.6 — la voce è per chiunque sia autenticato: TUTTI i ruoli, non i soli amministratori
    // ────────────────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// 🔴 <b>Il menu è visibilità, non autorizzazione.</b> Allargare la voce a ogni ruolo non
    /// allarga nulla lato dati: <c>VenditeQueries</c> e <c>VenditeMutations</c> dichiarano
    /// <c>this.Authorize()</c> a livello di tipo e continuano a pretendere un utente
    /// autenticato. Il criterio è «tutti i ruoli», non il sottoinsieme con il flag
    /// <c>Amministratore</c> — quello è il criterio di <c>SeedMenusSito</c>, che amministra.
    /// </summary>
    [Fact]
    public async Task UnRuoloNonAmministrativo_VedeLaVoceVendita()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            seme.Ruoli.Add(new Ruolo { Nome = "Cameriere", Descrizione = "Sala", Amministratore = false });
            CreaCassa(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu vendita = verifica.Menus.Include(m => m.Ruoli).Single(m => m.Percorso == PercorsoVendita);

        vendita.Ruoli.Select(r => r.Nome).Should().Contain(["Cameriere", "SuperAdmin"]);
    }

    /// <summary>
    /// Un ruolo nato dopo il primo avvio riceve la voce al riavvio successivo, e nessun ruolo
    /// perde ciò che aveva: <c>SeedMenus.AssegnaRuoli</c> è additivo per costruzione.
    /// </summary>
    [Fact]
    public async Task UnRuoloCreatoDopoIlSeed_RiceveLaVoceAlRiavvioSuccessivo()
    {
        string database = Guid.NewGuid().ToString();

        using (AppDbContext seme = CreaContesto(database))
        {
            CreaSuperAdmin(seme);
            CreaCassa(seme);
            await seme.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        using (AppDbContext dopo = CreaContesto(database))
        {
            dopo.Ruoli.Add(new Ruolo { Nome = "Barista", Descrizione = "Bancone", Amministratore = false });
            await dopo.SaveChangesAsync();
        }

        await SeedMenusVendita.Initialize(BuildProvider(database));

        using AppDbContext verifica = CreaContesto(database);
        Menu vendita = verifica.Menus.Include(m => m.Ruoli).Single(m => m.Percorso == PercorsoVendita);

        vendita.Ruoli.Select(r => r.Nome).Should().Contain(["Barista", "SuperAdmin"]);
    }
}
