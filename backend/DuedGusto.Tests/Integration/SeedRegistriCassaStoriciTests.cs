using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using duedgusto.SeedData;

using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// Verifica l'import una-tantum dello storico chiusure 2026 (SEED_REGISTRI_STORICI).
/// I valori attesi sono presi dal foglio Excel di origine, così il test fallisce se
/// la mappatura delle colonne o le formule dei totali cambiano.
/// </summary>
[Collection("SeedRegistriStorici")] // l'env var è stato globale: niente parallelismo
public class SeedRegistriCassaStoriciTests
{
    private const string EnvVar = "SEED_REGISTRI_STORICI";
    private const string EnvVarSostituisci = "SEED_REGISTRI_STORICI_SOSTITUISCI_INCOMPLETI";

    private static ServiceProvider BuildProvider(AppDbContext db)
    {
        var services = new ServiceCollection();
        services.AddSingleton(db); // stessa istanza dentro lo scope creato dal seed
        services.AddLogging();
        return services.BuildServiceProvider();
    }

    private static AppDbContext CreateDb(decimal vatRate = 0.10m)
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

        db.BusinessSettings.Add(new BusinessSettings
        {
            BusinessName = "Test",
            OpeningTime = "09:00",
            ClosingTime = "18:00",
            OperatingDays = "[true,true,true,true,true,true,false]",
            Timezone = "Europe/Rome",
            Currency = "EUR",
            VatRate = vatRate,
        });

        decimal[] tagli = [0.05m, 0.10m, 0.20m, 0.50m, 1m, 2m, 5m, 10m, 20m, 50m, 100m];
        for (int i = 0; i < tagli.Length; i++)
        {
            db.DenominazioniMoneta.Add(new DenominazioneMoneta
            {
                Valore = tagli[i],
                Tipo = tagli[i] >= 5m ? "BANKNOTE" : "COIN",
                OrdineVisualizzazione = i + 1,
            });
        }

        db.SaveChanges();
        return db;
    }

    private static async Task RunSeedAsync(AppDbContext db, string mode, bool sostituisciIncompleti = false)
    {
        Environment.SetEnvironmentVariable(EnvVar, mode);
        Environment.SetEnvironmentVariable(EnvVarSostituisci, sostituisciIncompleti ? "1" : null);
        try
        {
            await SeedRegistriCassaStorici.Initialize(BuildProvider(db));
        }
        finally
        {
            Environment.SetEnvironmentVariable(EnvVar, null);
            Environment.SetEnvironmentVariable(EnvVarSostituisci, null);
        }
    }

    /// <summary>Giornata aperta dall'app e mai chiusa, come il 06/07/2026 in produzione.</summary>
    private static async Task<int> AggiungiGiornoApertoAsync(AppDbContext db, DateTime data)
    {
        var registro = new RegistroCassa
        {
            Data = data,
            UtenteId = db.Utenti.First().Id,
            TotaleApertura = 53.95m,
            TotaleChiusura = 0m,
            Stato = "DRAFT",
        };
        db.RegistriCassa.Add(registro);
        await db.SaveChangesAsync();
        return registro.Id;
    }

    [Fact]
    public async Task SenzaVariabileDAmbiente_NonInserisceNulla()
    {
        using AppDbContext db = CreateDb();

        await SeedRegistriCassaStorici.Initialize(BuildProvider(db));

        db.RegistriCassa.Should().BeEmpty();
    }

    [Fact]
    public async Task Dryrun_NonScriveNulla()
    {
        using AppDbContext db = CreateDb();

        await RunSeedAsync(db, "dryrun");

        db.RegistriCassa.Should().BeEmpty();
    }

    [Fact]
    public async Task Apply_ImportaTuttoLoStorico()
    {
        using AppDbContext db = CreateDb();

        await RunSeedAsync(db, "1");

        List<RegistroCassa> registri = await db.RegistriCassa.OrderBy(r => r.Data).ToListAsync();

        registri.Should().HaveCount(177);
        registri.First().Data.Should().Be(new DateTime(2026, 1, 2));
        registri.Last().Data.Should().Be(new DateTime(2026, 8, 1));
        registri.Select(r => r.Data).Should().OnlyHaveUniqueItems();
        registri.Should().OnlyContain(r => r.Stato == "CLOSED");
    }

    [Fact]
    public async Task Apply_CalcolaITotaliComeIlFoglioExcel()
    {
        using AppDbContext db = CreateDb();

        await RunSeedAsync(db, "1");

        RegistroCassa r = await db.RegistriCassa
            .Include(x => x.ConteggiMoneta)
            .Include(x => x.SpeseCassa)
            .FirstAsync(x => x.Data == new DateTime(2026, 1, 2));

        // Valori del foglio "01 2026", primo blocco:
        // J=42,40 (apertura)  X=259,25 (chiusura)  Z=137,80  AA=29,60  AC=80,78
        r.TotaleApertura.Should().Be(42.40m);
        r.TotaleChiusura.Should().Be(259.25m);
        r.IncassoContanteTracciato.Should().Be(137.80m);
        r.IncassiElettronici.Should().Be(29.60m);
        r.SpeseGiornaliere.Should().Be(80.78m);

        // Colonne calcolate del foglio: Y "Totale (-) Apertura"=216,85  AB "Totale Vendite"=246,45
        r.ContanteNetto.Should().Be(216.85m);
        r.TotaleVendite.Should().Be(246.45m);

        // ATTENZIONE — discrepanza NOTA sull'import storico, non su questa formula.
        // Nel foglio AD "resto" vale 57,02 = Z(137,80) − AC(80,78), cioè il contante meno la
        // colonna delle spese FORNITORI. L'import però riversa quella colonna nelle spese con
        // scontrino (`SpeseCassa`) e lascia SpeseFornitori a 0 (SeedRegistriCassaStorici.cs:172,
        // "il foglio non distingue fornitori da spese generiche"), quindi qui i 80,78 finiscono
        // nel secchio sbagliato: RestoFornitore = 137,80 − 0 e il loro effetto ricade su Resto.
        // La somma dei due resta corretta; a cambiare è solo la ripartizione tracciato/non
        // tracciato dei mesi importati. Da chiarire separatamente prima di rettificare i dati.
        r.RestoFornitore.Should().Be(137.80m);
        r.Ecc.Should().Be(79.05m);            // 216,85 − 137,80
        r.Resto.Should().Be(-1.73m);          // 79,05 − 80,78

        r.ConteggiMoneta.Where(c => c.IsApertura).Sum(c => c.Totale).Should().Be(42.40m);
        r.ConteggiMoneta.Where(c => !c.IsApertura).Sum(c => c.Totale).Should().Be(259.25m);
        r.SpeseCassa.Should().ContainSingle().Which.Importo.Should().Be(80.78m);
    }

    [Fact]
    public async Task Apply_TieneLaFatturaFuoriDalContanteMaDentroLeVendite()
    {
        using AppDbContext db = CreateDb();

        await RunSeedAsync(db, "1");

        // 09/01: il foglio somma la fattura (W=18,90) dentro al totale di chiusura (X=246,05).
        // Nell'app il contante contato resta 227,15 e la fattura ha il suo campo, ma
        // TotaleVendite deve tornare identico all'AB del foglio: 217,65.
        RegistroCassa r = await db.RegistriCassa.FirstAsync(x => x.Data == new DateTime(2026, 1, 9));

        r.TotaleChiusura.Should().Be(227.15m);
        r.IncassiFattura.Should().Be(18.90m);
        r.TotaleVendite.Should().Be(217.65m);
    }

    [Fact]
    public async Task Apply_SaltaLeDateGiaPresentiSenzaSovrascriverle()
    {
        using AppDbContext db = CreateDb();
        int utenteId = db.Utenti.First().Id;

        // Giorno già inserito dall'app: deve restare intatto.
        db.RegistriCassa.Add(new RegistroCassa
        {
            Data = new DateTime(2026, 1, 2),
            UtenteId = utenteId,
            TotaleApertura = 999m,
            TotaleChiusura = 1234m,
            Stato = "RECONCILED",
            Note = "inserito a mano",
        });
        await db.SaveChangesAsync();

        await RunSeedAsync(db, "1");

        db.RegistriCassa.Should().HaveCount(177); // 176 importati + 1 preesistente

        RegistroCassa esistente = await db.RegistriCassa.FirstAsync(x => x.Data == new DateTime(2026, 1, 2));
        esistente.TotaleChiusura.Should().Be(1234m);
        esistente.Stato.Should().Be("RECONCILED");
        esistente.Note.Should().Be("inserito a mano");
    }

    [Fact]
    public async Task Apply_EIdempotente()
    {
        using AppDbContext db = CreateDb();

        await RunSeedAsync(db, "1");
        await RunSeedAsync(db, "1");

        db.RegistriCassa.Should().HaveCount(177);
        db.ConteggiMoneta.Count().Should().Be(await db.RegistriCassa
            .Include(r => r.ConteggiMoneta)
            .SumAsync(r => r.ConteggiMoneta.Count));
    }

    [Fact]
    public async Task GiornoRimastoAperto_SenzaLOpzione_VieneSaltato()
    {
        using AppDbContext db = CreateDb();
        int id = await AggiungiGiornoApertoAsync(db, new DateTime(2026, 7, 6));

        await RunSeedAsync(db, "1"); // opzione NON attiva

        RegistroCassa r = await db.RegistriCassa.FirstAsync(x => x.Id == id);
        r.TotaleChiusura.Should().Be(0m);
        r.Stato.Should().Be("DRAFT");
    }

    [Fact]
    public async Task GiornoRimastoAperto_ConLOpzione_VieneCompletatoSullaStessaRiga()
    {
        using AppDbContext db = CreateDb();
        int id = await AggiungiGiornoApertoAsync(db, new DateTime(2026, 7, 6));

        await RunSeedAsync(db, "1", sostituisciIncompleti: true);

        RegistroCassa r = await db.RegistriCassa
            .Include(x => x.ConteggiMoneta)
            .FirstAsync(x => x.Data == new DateTime(2026, 7, 6));

        r.Id.Should().Be(id); // aggiornato sul posto, non ricreato
        r.Stato.Should().Be("CLOSED");
        // Valori del foglio "07 2026" per il 06/07: apertura 53,95 chiusura 305,55
        r.TotaleApertura.Should().Be(53.95m);
        r.TotaleChiusura.Should().Be(305.55m);
        r.IncassoContanteTracciato.Should().Be(178.80m);
        r.IncassiElettronici.Should().Be(76.60m);
        r.SpeseGiornaliere.Should().Be(152.95m);
        r.ConteggiMoneta.Where(c => c.IsApertura).Sum(c => c.Totale).Should().Be(53.95m);

        db.RegistriCassa.Should().HaveCount(177); // nessun duplicato per quella data
    }

    [Fact]
    public async Task GiornoApertoMaConMovimenti_ConLOpzione_RestaIntatto()
    {
        using AppDbContext db = CreateDb();
        int id = await AggiungiGiornoApertoAsync(db, new DateTime(2026, 7, 6));

        // Una spesa collegata: c'e' qualcosa da perdere, quindi non va toccato.
        db.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = id,
            Descrizione = "spesa inserita a mano",
            Importo = 12.50m,
            Categoria = CategoriaSpesa.Altro,
        });
        await db.SaveChangesAsync();

        await RunSeedAsync(db, "1", sostituisciIncompleti: true);

        RegistroCassa r = await db.RegistriCassa.FirstAsync(x => x.Id == id);
        r.TotaleChiusura.Should().Be(0m);
        r.Stato.Should().Be("DRAFT");
        db.SpeseCassa.Where(s => s.RegistroCassaId == id)
            .Should().ContainSingle().Which.Descrizione.Should().Be("spesa inserita a mano");
    }

    [Fact]
    public async Task GiornoGiaChiuso_ConLOpzione_NonVieneMaiSovrascritto()
    {
        using AppDbContext db = CreateDb();
        db.RegistriCassa.Add(new RegistroCassa
        {
            Data = new DateTime(2026, 1, 2),
            UtenteId = db.Utenti.First().Id,
            TotaleApertura = 10m,
            TotaleChiusura = 1234m,
            Stato = "CLOSED",
            Note = "chiuso dall'app",
        });
        await db.SaveChangesAsync();

        await RunSeedAsync(db, "1", sostituisciIncompleti: true);

        RegistroCassa r = await db.RegistriCassa.FirstAsync(x => x.Data == new DateTime(2026, 1, 2));
        r.TotaleChiusura.Should().Be(1234m);
        r.Note.Should().Be("chiuso dall'app");
    }

    [Fact]
    public async Task Apply_SenzaDenominazioni_NonInserisceNulla()
    {
        using AppDbContext db = CreateDb();
        db.DenominazioniMoneta.RemoveRange(db.DenominazioniMoneta);
        await db.SaveChangesAsync();

        await RunSeedAsync(db, "1");

        db.RegistriCassa.Should().BeEmpty();
    }
}
