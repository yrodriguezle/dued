using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.SeedData;
using duedgusto.Services.Fornitori;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// Verifica il data-fix che riaggancia i pagamenti fornitori orfani al registro cassa della
/// loro data. Un pagamento con <c>RegistroCassaId</c> NULL non entra in nessuna chiusura,
/// perché il totale mensile somma <c>SpeseFornitori</c> dei registri inclusi e non guarda mai
/// <c>DataPagamento</c>.
/// </summary>
public class SeedRiparaPagamentiOrfaniTests
{
    private static ServiceProvider BuildProvider(AppDbContext db)
    {
        var services = new ServiceCollection();
        services.AddSingleton(db); // stessa istanza dentro lo scope creato dal seed
        services.AddLogging();
        services.AddScoped<IUnitOfWork>(_ => new UnitOfWork(db));
        services.AddScoped<RegistroCassaSyncService>();
        return services.BuildServiceProvider();
    }

    private static AppDbContext CreateDb()
    {
        AppDbContext db = TestDbContextFactory.Create();

        var ruolo = new Ruolo { Nome = "SuperAdmin", Descrizione = "test" };
        db.Ruoli.Add(ruolo);
        db.SaveChanges();

        db.Utenti.Add(new Utente
        {
            NomeUtente = "superadmin",
            Nome = "Super Admin",
            Hash = [1],
            Salt = [1],
            RuoloId = ruolo.Id,
        });
        db.SaveChanges();

        return db;
    }

    [Fact]
    public async Task Orfano_SuGiornoSenzaRegistro_CreaIlRegistroDraftELoCollega()
    {
        using AppDbContext db = CreateDb();
        db.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 7, 31),
            Importo = 122m,
            RegistroCassaId = null,
        });
        await db.SaveChangesAsync();

        await SeedRiparaPagamentiOrfani.Initialize(BuildProvider(db));

        PagamentoFornitore pagamento = await db.PagamentiFornitori.SingleAsync();
        pagamento.RegistroCassaId.Should().NotBeNull();

        RegistroCassa registro = await db.RegistriCassa.SingleAsync();
        registro.Data.Date.Should().Be(new DateTime(2026, 7, 31));
        registro.Stato.Should().Be("DRAFT");
        registro.SpeseFornitori.Should().Be(122m);
    }

    [Fact]
    public async Task Orfano_SuGiornoConRegistroEsistente_RiusaIlRegistroEAggiornaSpese()
    {
        using AppDbContext db = CreateDb();
        Utente utente = await db.Utenti.FirstAsync();
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 7, 31),
            UtenteId = utente.Id,
            Stato = "CLOSED",
            TotaleApertura = 100m,
            TotaleChiusura = 400m,
            IncassoContanteTracciato = 220m,
        };
        db.RegistriCassa.Add(registro);
        await db.SaveChangesAsync();

        db.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 7, 31),
            Importo = 122m,
            RegistroCassaId = null,
        });
        await db.SaveChangesAsync();

        await SeedRiparaPagamentiOrfani.Initialize(BuildProvider(db));

        db.RegistriCassa.Count().Should().Be(1);
        PagamentoFornitore pagamento = await db.PagamentiFornitori.SingleAsync();
        pagamento.RegistroCassaId.Should().Be(registro.Id);
        registro.SpeseFornitori.Should().Be(122m);
        // La quadratura passa dalla fonte unica: RestoFornitore = contanti - speseFornitori.
        registro.RestoFornitore.Should().Be(98m);
    }

    [Fact]
    public async Task SecondaEsecuzione_NonAlteraNulla()
    {
        using AppDbContext db = CreateDb();
        db.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 7, 31),
            Importo = 122m,
            RegistroCassaId = null,
        });
        await db.SaveChangesAsync();

        await SeedRiparaPagamentiOrfani.Initialize(BuildProvider(db));
        await SeedRiparaPagamentiOrfani.Initialize(BuildProvider(db));

        db.RegistriCassa.Count().Should().Be(1);
        RegistroCassa registro = await db.RegistriCassa.SingleAsync();
        registro.SpeseFornitori.Should().Be(122m);
    }

    [Fact]
    public async Task PagamentiGiaCollegati_RestanoIntoccati()
    {
        using AppDbContext db = CreateDb();
        Utente utente = await db.Utenti.FirstAsync();
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 7, 20),
            UtenteId = utente.Id,
            Stato = "CLOSED",
            SpeseFornitori = 50m,
        };
        db.RegistriCassa.Add(registro);
        await db.SaveChangesAsync();

        db.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 7, 20),
            Importo = 50m,
            RegistroCassaId = registro.Id,
        });
        await db.SaveChangesAsync();

        await SeedRiparaPagamentiOrfani.Initialize(BuildProvider(db));

        db.RegistriCassa.Count().Should().Be(1);
        registro.SpeseFornitori.Should().Be(50m);
    }
}
