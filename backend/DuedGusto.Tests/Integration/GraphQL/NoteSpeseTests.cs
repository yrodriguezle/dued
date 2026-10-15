using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Copre la separazione fra causale e annotazione sulle righe di spesa.
/// Prima le spese fisse tracciate tenevano la causale dentro <c>PagamentoFornitore.Note</c>,
/// per mancanza di un campo proprio: annotare la riga ne avrebbe sovrascritto la causale.
/// Ora la causale sta in <c>Descrizione</c> e <c>Note</c> torna a essere una nota, come
/// gia era sui pagamenti documentali.
/// </summary>
public class NoteSpeseTests : IDisposable
{
    private readonly AppDbContext _dbContext;

    public NoteSpeseTests()
    {
        _dbContext = TestDbContextFactory.Create();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task<RegistroCassa> SeedRegistroAsync()
    {
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Ruolo Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        await _dbContext.SaveChangesAsync();

        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        await _dbContext.SaveChangesAsync();

        var registro = new RegistroCassa { Data = new DateTime(2026, 6, 30), UtenteId = utente.Id, Stato = "DRAFT" };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();
        return registro;
    }

    private async Task<int> CategoriaIdAsync(string nome)
    {
        CategoriaSpesa? categoria = await _dbContext.CategorieSpesa
            .FirstOrDefaultAsync(c => c.Nome == nome);
        if (categoria == null)
        {
            categoria = new CategoriaSpesa { Nome = nome, Attiva = true, Ordine = await _dbContext.CategorieSpesa.CountAsync() };
            _dbContext.CategorieSpesa.Add(categoria);
            await _dbContext.SaveChangesAsync();
        }
        return categoria.Id;
    }

    [Fact]
    public async Task SpesaCassa_NoteEDescrizione_SonoIndipendenti()
    {
        RegistroCassa registro = await SeedRegistroAsync();

        _dbContext.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Stipendio Dore",
            Importo = 700m,
            CategoriaId = await CategoriaIdAsync("Stipendi"),
            Note = "+300 dallo stipendio di Doris"
        });
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        SpesaCassa? letta = await _dbContext.SpeseCassa.FirstOrDefaultAsync();

        letta.Should().NotBeNull();
        letta!.Descrizione.Should().Be("Stipendio Dore");
        letta.Note.Should().Be("+300 dallo stipendio di Doris");
    }

    [Fact]
    public async Task SpesaCassa_SenzaNota_RestaNull()
    {
        RegistroCassa registro = await SeedRegistroAsync();

        _dbContext.SpeseCassa.Add(new SpesaCassa
        {
            RegistroCassaId = registro.Id,
            Descrizione = "Affitto",
            Importo = 900m,
            CategoriaId = await CategoriaIdAsync("Affitto")
        });
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        SpesaCassa? letta = await _dbContext.SpeseCassa.FirstOrDefaultAsync();

        letta!.Note.Should().BeNull();
    }

    [Fact]
    public async Task PagamentoFornitore_CausaleEAnnotazione_NonSiSovrascrivono()
    {
        _dbContext.PagamentiFornitori.Add(new PagamentoFornitore
        {
            DataPagamento = new DateTime(2026, 6, 30),
            Importo = 1380m,
            MetodoPagamento = "Bonifico",
            CategoriaId = await CategoriaIdAsync("Stipendi"),
            Descrizione = "Stipendio Doris",
            Note = "-300 girati a Dore"
        });
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        PagamentoFornitore? letto = await _dbContext.PagamentiFornitori.FirstOrDefaultAsync();

        letto.Should().NotBeNull();
        letto!.Descrizione.Should().Be("Stipendio Doris");
        letto.Note.Should().Be("-300 girati a Dore");
    }

    [Fact]
    public async Task PagamentoDocumentale_UsaNoteComeNota_ESenzaCausalePropria()
    {
        // I pagamenti legati a fattura/DDT non sono toccati dalla separazione:
        // la loro Note e sempre stata una nota e la causale viene dal documento.
        _dbContext.PagamentiFornitori.Add(new PagamentoFornitore
        {
            FatturaId = null,
            DataPagamento = new DateTime(2026, 6, 2),
            Importo = 127m,
            MetodoPagamento = "Contanti",
            CategoriaId = null,
            Note = "Pagamento da registro cassa del 02/06/2026"
        });
        await _dbContext.SaveChangesAsync();
        _dbContext.ChangeTracker.Clear();

        PagamentoFornitore? letto = await _dbContext.PagamentiFornitori.FirstOrDefaultAsync();

        letto!.Note.Should().Be("Pagamento da registro cassa del 02/06/2026");
        letto.Descrizione.Should().BeNull();
    }
}
