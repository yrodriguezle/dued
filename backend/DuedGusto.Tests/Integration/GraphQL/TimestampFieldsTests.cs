using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Verifica che CreatedAt/UpdatedAt (rinominate da CreatoIl/AggiornatoIl)
/// funzionino correttamente su tutte le entità: insert, read, update.
/// </summary>
public class TimestampFieldsTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public TimestampFieldsTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Utente SeedUtente()
    {
        var utente = JwtTestHelper.CreateTestUtente();
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private BusinessSettings SeedSettings()
    {
        var settings = new BusinessSettings
        {
            BusinessName = "Test Bar",
            OpeningTime = "08:00",
            ClosingTime = "20:00",
            OperatingDays = "[true,true,true,true,true,false,false]",
            Timezone = "Europe/Rome",
            Currency = "EUR",
            VatRate = 22m
        };
        _dbContext.BusinessSettings.Add(settings);
        _dbContext.SaveChanges();
        return settings;
    }

    private Fornitore SeedFornitore()
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = "Test Fornitore SRL",
            Paese = "IT",
            Attivo = true
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    private RegistroCassa SeedRegistroCassa(int utenteId)
    {
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 3, 15),
            UtenteId = utenteId,
            Stato = "DRAFT"
        };
        _dbContext.RegistriCassa.Add(registro);
        _dbContext.SaveChanges();
        return registro;
    }

    private Prodotto SeedProdotto()
    {
        var prodotto = new Prodotto
        {
            Codice = "TST-001",
            Nome = "Prodotto Test",
            Prezzo = 5.00m,
            Attivo = true
        };
        _dbContext.Prodotti.Add(prodotto);
        _dbContext.SaveChanges();
        return prodotto;
    }

    private ChiusuraMensile SeedChiusura()
    {
        var chiusura = new ChiusuraMensile
        {
            Anno = 2026,
            Mese = 3,
            Stato = "BOZZA"
        };
        _dbContext.ChiusureMensili.Add(chiusura);
        _dbContext.SaveChanges();
        return chiusura;
    }

    #endregion

    #region Fornitore

    [Fact]
    public async Task Fornitore_Insert_SetsCreatedAtAndUpdatedAt()
    {
        var before = DateTime.UtcNow.AddSeconds(-1);
        var fornitore = new Fornitore
        {
            RagioneSociale = "Timestamp Test SRL",
            Paese = "IT",
            Attivo = true
        };
        _dbContext.Fornitori.Add(fornitore);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public async Task Fornitore_Update_ChangesUpdatedAt()
    {
        var fornitore = SeedFornitore();
        var originalCreatedAt = fornitore.CreatedAt;

        var loaded = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        loaded.RagioneSociale = "Nuovo Nome";
        loaded.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.Fornitori.FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);
        result.CreatedAt.Should().Be(originalCreatedAt);
        result.UpdatedAt.Should().BeOnOrAfter(originalCreatedAt);
    }

    #endregion

    #region DocumentoTrasporto

    [Fact]
    public async Task DocumentoTrasporto_Insert_SetsTimestamps()
    {
        var fornitore = SeedFornitore();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var ddt = new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroDdt = "DDT-TS-001",
            DataDdt = DateTime.UtcNow
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.DocumentiTrasporto.FirstAsync(d => d.DdtId == ddt.DdtId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public async Task DocumentoTrasporto_Update_ChangesUpdatedAt()
    {
        var fornitore = SeedFornitore();
        var ddt = new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroDdt = "DDT-TS-002",
            DataDdt = DateTime.UtcNow
        };
        _dbContext.DocumentiTrasporto.Add(ddt);
        await _dbContext.SaveChangesAsync();
        var originalCreatedAt = ddt.CreatedAt;

        var loaded = await _dbContext.DocumentiTrasporto.FirstAsync(d => d.DdtId == ddt.DdtId);
        loaded.Note = "Nota aggiornata";
        loaded.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.DocumentiTrasporto.FirstAsync(d => d.DdtId == ddt.DdtId);
        result.CreatedAt.Should().Be(originalCreatedAt);
        result.UpdatedAt.Should().BeOnOrAfter(originalCreatedAt);
    }

    #endregion

    #region FatturaAcquisto

    [Fact]
    public async Task FatturaAcquisto_Insert_SetsTimestamps()
    {
        var fornitore = SeedFornitore();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var fattura = new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-TS-001",
            DataFattura = DateTime.UtcNow,
            Imponibile = 100m,
            Stato = "DA_PAGARE"
        };
        _dbContext.FattureAcquisto.Add(fattura);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.FattureAcquisto.FirstAsync(f => f.FatturaId == fattura.FatturaId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region PagamentoFornitore

    [Fact]
    public async Task PagamentoFornitore_Insert_SetsTimestamps()
    {
        var fornitore = SeedFornitore();
        var fattura = new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-PAG-001",
            DataFattura = DateTime.UtcNow,
            Imponibile = 500m,
            Stato = "DA_PAGARE"
        };
        _dbContext.FattureAcquisto.Add(fattura);
        await _dbContext.SaveChangesAsync();

        var before = DateTime.UtcNow.AddSeconds(-1);
        var pagamento = new PagamentoFornitore
        {
            FatturaId = fattura.FatturaId,
            Importo = 500m,
            DataPagamento = DateTime.UtcNow,
            MetodoPagamento = "CONTANTI"
        };
        _dbContext.PagamentiFornitori.Add(pagamento);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.PagamentiFornitori.FirstAsync(p => p.PagamentoId == pagamento.PagamentoId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region RegistroCassa

    [Fact]
    public async Task RegistroCassa_Insert_SetsTimestamps()
    {
        var utente = SeedUtente();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 3, 20),
            UtenteId = utente.Id,
            Stato = "DRAFT"
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public async Task RegistroCassa_Update_ChangesUpdatedAt()
    {
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente.Id);
        var originalCreatedAt = registro.CreatedAt;

        var loaded = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        loaded.Note = "Nota aggiornata";
        loaded.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registro.Id);
        result.CreatedAt.Should().Be(originalCreatedAt);
        result.UpdatedAt.Should().BeOnOrAfter(originalCreatedAt);
    }

    #endregion

    #region Prodotto

    [Fact]
    public async Task Prodotto_Insert_SetsTimestamps()
    {
        var before = DateTime.UtcNow.AddSeconds(-1);

        var prodotto = new Prodotto
        {
            Codice = "TS-PROD-001",
            Nome = "Prodotto Timestamp",
            Prezzo = 10.00m,
            Attivo = true
        };
        _dbContext.Prodotti.Add(prodotto);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.Prodotti.FirstAsync(p => p.ProdottoId == prodotto.ProdottoId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region Vendita

    [Fact]
    public async Task Vendita_Insert_SetsTimestamps()
    {
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente.Id);
        var prodotto = SeedProdotto();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 2,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = 2 * prodotto.Prezzo,
            DataOra = DateTime.UtcNow
        };
        _dbContext.Vendite.Add(vendita);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.Vendite.FirstAsync(v => v.VenditaId == vendita.VenditaId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public async Task Vendita_Update_ChangesUpdatedAt()
    {
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente.Id);
        var prodotto = SeedProdotto();
        var vendita = new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 1,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = prodotto.Prezzo,
            DataOra = DateTime.UtcNow
        };
        _dbContext.Vendite.Add(vendita);
        await _dbContext.SaveChangesAsync();
        var originalCreatedAt = vendita.CreatedAt;

        var loaded = await _dbContext.Vendite.FirstAsync(v => v.VenditaId == vendita.VenditaId);
        loaded.Quantita = 5;
        loaded.PrezzoTotale = 5 * prodotto.Prezzo;
        loaded.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.Vendite.FirstAsync(v => v.VenditaId == vendita.VenditaId);
        result.CreatedAt.Should().Be(originalCreatedAt);
        result.UpdatedAt.Should().BeOnOrAfter(originalCreatedAt);
    }

    #endregion

    #region ChiusuraMensile

    [Fact]
    public async Task ChiusuraMensile_Insert_SetsTimestamps()
    {
        var before = DateTime.UtcNow.AddSeconds(-1);

        var chiusura = new ChiusuraMensile
        {
            Anno = 2026,
            Mese = 3,
            Stato = "BOZZA"
        };
        _dbContext.ChiusureMensili.Add(chiusura);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.ChiusureMensili.FirstAsync(c => c.ChiusuraId == chiusura.ChiusuraId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public async Task ChiusuraMensile_Update_ChangesUpdatedAt()
    {
        var chiusura = SeedChiusura();
        var originalCreatedAt = chiusura.CreatedAt;

        var loaded = await _dbContext.ChiusureMensili.FirstAsync(c => c.ChiusuraId == chiusura.ChiusuraId);
        loaded.Stato = "CHIUSA";
        loaded.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.ChiusureMensili.FirstAsync(c => c.ChiusuraId == chiusura.ChiusuraId);
        result.CreatedAt.Should().Be(originalCreatedAt);
        result.UpdatedAt.Should().BeOnOrAfter(originalCreatedAt);
    }

    #endregion

    #region SpesaMensile

    [Fact]
    public async Task SpesaMensile_Insert_SetsTimestamps()
    {
        var chiusura = SeedChiusura();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var spesa = new SpesaMensile
        {
            ChiusuraId = chiusura.ChiusuraId,
            Descrizione = "Spesa test",
            Importo = 100m,
            Categoria = "ALTRO"
        };
        _dbContext.SpeseMensili.Add(spesa);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.SpeseMensili.FirstAsync(s => s.SpesaId == spesa.SpesaId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region SpesaMensileLibera

    [Fact]
    public async Task SpesaMensileLibera_Insert_SetsTimestamps()
    {
        var chiusura = SeedChiusura();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var spesa = new SpesaMensileLibera
        {
            ChiusuraId = chiusura.ChiusuraId,
            Descrizione = "Affitto test",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto
        };
        _dbContext.SpeseMensiliLibere.Add(spesa);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.SpeseMensiliLibere.FirstAsync(s => s.SpesaId == spesa.SpesaId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region PeriodoProgrammazione

    [Fact]
    public async Task PeriodoProgrammazione_Insert_SetsTimestamps()
    {
        var settings = SeedSettings();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var periodo = new PeriodoProgrammazione
        {
            SettingsId = settings.SettingsId,
            DataInizio = new DateOnly(2026, 1, 1),
            GiorniOperativi = "[true,true,true,true,true,false,false]"
        };
        _dbContext.PeriodiProgrammazione.Add(periodo);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.PeriodiProgrammazione.FirstAsync(p => p.PeriodoId == periodo.PeriodoId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region GiornoNonLavorativo

    [Fact]
    public async Task GiornoNonLavorativo_Insert_SetsTimestamps()
    {
        var settings = SeedSettings();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var giorno = new GiornoNonLavorativo
        {
            SettingsId = settings.SettingsId,
            Data = new DateOnly(2026, 12, 25),
            Descrizione = "Natale",
            CodiceMotivo = "FESTIVITA_NAZIONALE",
            Ricorrente = true
        };
        _dbContext.GiorniNonLavorativi.Add(giorno);
        await _dbContext.SaveChangesAsync();

        var loaded = await _dbContext.GiorniNonLavorativi.FirstAsync(g => g.GiornoId == giorno.GiornoId);
        loaded.CreatedAt.Should().BeAfter(before);
        loaded.UpdatedAt.Should().BeAfter(before);
    }

    #endregion

    #region Cross-entity: Read timestamps from navigation properties

    [Fact]
    public async Task Fornitore_WithRelations_AllTimestampsPresent()
    {
        var fornitore = SeedFornitore();

        _dbContext.FattureAcquisto.Add(new FatturaAcquisto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-REL-001",
            DataFattura = DateTime.UtcNow,
            Imponibile = 1000m,
            Stato = "DA_PAGARE"
        });
        _dbContext.DocumentiTrasporto.Add(new DocumentoTrasporto
        {
            FornitoreId = fornitore.FornitoreId,
            NumeroDdt = "DDT-REL-001",
            DataDdt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.Fornitori
            .Include(f => f.FattureAcquisto)
            .Include(f => f.DocumentiTrasporto)
            .FirstAsync(f => f.FornitoreId == fornitore.FornitoreId);

        // Fornitore timestamps
        result.CreatedAt.Should().NotBe(default);
        result.UpdatedAt.Should().NotBe(default);

        // FatturaAcquisto timestamps
        result.FattureAcquisto.Should().HaveCount(1);
        result.FattureAcquisto.First().CreatedAt.Should().NotBe(default);
        result.FattureAcquisto.First().UpdatedAt.Should().NotBe(default);

        // DocumentoTrasporto timestamps
        result.DocumentiTrasporto.Should().HaveCount(1);
        result.DocumentiTrasporto.First().CreatedAt.Should().NotBe(default);
        result.DocumentiTrasporto.First().UpdatedAt.Should().NotBe(default);
    }

    [Fact]
    public async Task RegistroCassa_WithVendite_AllTimestampsPresent()
    {
        var utente = SeedUtente();
        var registro = SeedRegistroCassa(utente.Id);
        var prodotto = SeedProdotto();

        _dbContext.Vendite.Add(new Vendita
        {
            RegistroCassaId = registro.Id,
            ProdottoId = prodotto.ProdottoId,
            Quantita = 3,
            PrezzoUnitario = prodotto.Prezzo,
            PrezzoTotale = 3 * prodotto.Prezzo,
            DataOra = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.RegistriCassa
            .Include(r => r.PagamentiFornitori)
            .FirstAsync(r => r.Id == registro.Id);

        result.CreatedAt.Should().NotBe(default);
        result.UpdatedAt.Should().NotBe(default);
    }

    #endregion
}
