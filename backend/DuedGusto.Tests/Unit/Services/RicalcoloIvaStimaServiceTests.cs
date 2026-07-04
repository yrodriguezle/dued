using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

using duedgusto.DataAccess;
using duedgusto.Models;
using duedgusto.Services;
using DuedGusto.Tests.Helpers;

using FluentAssertions;

namespace DuedGusto.Tests.Unit.Services;

/// <summary>
/// Test della rettifica gestionale del residuo IVA stimato (issue #6):
/// scope per Stato, esclusione mesi consolidati, invarianti e dry-run.
/// </summary>
public class RicalcoloIvaStimaServiceTests
{
    private static readonly DateTime Now = new(2026, 7, 4, 12, 0, 0, DateTimeKind.Utc);
    private const decimal VatRate10 = 0.10m;

    /// <summary>Crea un registro con una riga IVA stimata al 22% (lordo 110 → imponibile 90.16, iva 19.84).</summary>
    private static RegistroCassa RegistroConStima22(int id, string stato, DateTime data, decimal importoIvaIniziale = 19.84m)
    {
        return new RegistroCassa
        {
            Id = id,
            Data = data,
            UtenteId = 1,
            Stato = stato,
            ImportoIva = importoIvaIniziale,
            BreakdownIva = new List<RegistroCassaIva>
            {
                new() { RegistroCassaId = id, Aliquota = 22m, Imponibile = 90.16m, Imposta = 19.84m, Stimato = true },
            },
        };
    }

    [Fact]
    public async Task Ricalcola_registro_DRAFT_riporta_stima_da_22_a_10()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        db.RegistriCassa.Add(RegistroConStima22(1, "DRAFT", new DateTime(2026, 6, 10)));
        await db.SaveChangesAsync();

        EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
            db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        esito.RegistriModificati.Should().Be(1);

        RegistroCassaIva riga = await db.RegistriCassaIva.SingleAsync();
        riga.Stimato.Should().BeTrue();
        riga.Aliquota.Should().Be(10m);
        // lordo 110 invariato: imponibile 100.00, iva 10.00
        riga.Imponibile.Should().Be(100.00m);
        riga.Imposta.Should().Be(10.00m);
        // invariante: imponibile + imposta == lordo originale
        (riga.Imponibile + riga.Imposta).Should().Be(110.00m);

        RegistroCassa reg = await db.RegistriCassa.SingleAsync();
        reg.ImportoIva.Should().Be(10.00m); // 19.84 + (10.00 - 19.84)
        reg.Note.Should().Contain("fix#6").And.Contain("22%→10%");
    }

    [Fact]
    public async Task Non_tocca_le_righe_itemizzate_al_22()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        var reg = new RegistroCassa
        {
            Id = 1,
            Data = new DateTime(2026, 6, 10),
            UtenteId = 1,
            Stato = "DRAFT",
            ImportoIva = 30m,
            BreakdownIva = new List<RegistroCassaIva>
            {
                // riga itemizzata (snapshot prodotto) al 22% — NON deve cambiare
                new() { RegistroCassaId = 1, Aliquota = 22m, Imponibile = 45.90m, Imposta = 10.10m, Stimato = false },
                // riga stimata al 22% — deve diventare 10%
                new() { RegistroCassaId = 1, Aliquota = 22m, Imponibile = 90.16m, Imposta = 19.84m, Stimato = true },
            },
        };
        db.RegistriCassa.Add(reg);
        await db.SaveChangesAsync();

        await RicalcoloIvaStimaService.EseguiAsync(db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        RegistroCassaIva itemizzata = await db.RegistriCassaIva.SingleAsync(r => !r.Stimato);
        itemizzata.Aliquota.Should().Be(22m);
        itemizzata.Imponibile.Should().Be(45.90m);
        itemizzata.Imposta.Should().Be(10.10m);

        RegistroCassaIva stimata = await db.RegistriCassaIva.SingleAsync(r => r.Stimato);
        stimata.Aliquota.Should().Be(10m);
    }

    [Fact]
    public async Task Ricalcola_registro_CLOSED_non_in_mese_consolidato()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        db.RegistriCassa.Add(RegistroConStima22(1, "CLOSED", new DateTime(2026, 6, 10)));
        await db.SaveChangesAsync();

        EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
            db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        esito.RegistriModificati.Should().Be(1);
        (await db.RegistriCassaIva.SingleAsync()).Aliquota.Should().Be(10m);
    }

    [Fact]
    public async Task Esclude_registro_RECONCILED()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        db.RegistriCassa.Add(RegistroConStima22(1, "RECONCILED", new DateTime(2026, 6, 10)));
        await db.SaveChangesAsync();

        EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
            db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        esito.RegistriEsaminati.Should().Be(0);
        esito.RegistriModificati.Should().Be(0);
        (await db.RegistriCassaIva.SingleAsync()).Aliquota.Should().Be(22m); // intatta
    }

    [Fact]
    public async Task Esclude_registro_in_mese_con_chiusura_CHIUSA()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        db.RegistriCassa.Add(RegistroConStima22(1, "CLOSED", new DateTime(2026, 6, 10)));
        db.ChiusureMensili.Add(new ChiusuraMensile { ChiusuraId = 1, Anno = 2026, Mese = 6, Stato = "CHIUSA" });
        await db.SaveChangesAsync();

        EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
            db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        esito.RegistriModificati.Should().Be(0);
        (await db.RegistriCassaIva.SingleAsync()).Aliquota.Should().Be(22m); // intatta
    }

    [Fact]
    public async Task Non_seleziona_registri_gia_al_10()
    {
        await using AppDbContext db = TestDbContextFactory.Create();
        var reg = new RegistroCassa
        {
            Id = 1,
            Data = new DateTime(2026, 6, 10),
            UtenteId = 1,
            Stato = "DRAFT",
            ImportoIva = 10m,
            BreakdownIva = new List<RegistroCassaIva>
            {
                new() { RegistroCassaId = 1, Aliquota = 10m, Imponibile = 100m, Imposta = 10m, Stimato = true },
            },
        };
        db.RegistriCassa.Add(reg);
        await db.SaveChangesAsync();

        EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
            db, VatRate10, dryRun: false, Now, NullLogger.Instance);

        esito.RegistriEsaminati.Should().Be(0);
    }

    [Fact]
    public async Task DryRun_non_persiste_le_modifiche()
    {
        string dbName = Guid.NewGuid().ToString();
        await using (AppDbContext db = TestDbContextFactory.Create(dbName))
        {
            db.RegistriCassa.Add(RegistroConStima22(1, "DRAFT", new DateTime(2026, 6, 10)));
            await db.SaveChangesAsync();

            EsitoRicalcoloIvaStima esito = await RicalcoloIvaStimaService.EseguiAsync(
                db, VatRate10, dryRun: true, Now, NullLogger.Instance);

            esito.RegistriModificati.Should().Be(1); // calcolato...
        }

        // ...ma non salvato: un nuovo contesto sullo stesso store legge il 22% originale
        await using AppDbContext verifica = TestDbContextFactory.Create(dbName);
        (await verifica.RegistriCassaIva.SingleAsync()).Aliquota.Should().Be(22m);
    }
}
