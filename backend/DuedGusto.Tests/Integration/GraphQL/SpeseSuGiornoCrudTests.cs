using DuedGusto.Tests.Helpers;

using GraphQL;

using duedgusto.GraphQL.Fornitori;
using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.GestioneCassa;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.Repositories.Implementations;
using duedgusto.Repositories.Interfaces;
using duedgusto.Services.ChiusureMensili;
using duedgusto.Services.Events;
using duedgusto.Services.Fornitori;

namespace DuedGusto.Tests.Integration.GraphQL;

/// <summary>
/// Tests per il CRUD granulare per-riga instradato al registro del GIORNO
/// (<see cref="SpesaCassaSuGiornoOrchestrator"/> e <see cref="PagamentoFornitoreSuGiornoOrchestrator"/>).
/// Copre: create/update/delete di SpeseCassa, spostamento su cambio data con cleanup del registro
/// "leggero" d'origine (Decision 3), create semplice e con fattura "FA" dei PagamentoFornitori
/// (Decision 2), ricalcolo di SpeseGiornaliere/SpeseFornitori, guardie GuardMeseChiuso e blocco
/// RECONCILED (Decision 4) e non-eliminazione del registro con contenuto residuo.
/// </summary>
public class SpeseSuGiornoCrudTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly IUnitOfWork _uow;
    private readonly RegistroCassaSyncService _syncService;
    private readonly SpesaCassaSuGiornoOrchestrator _spesaOrchestrator;
    private readonly PagamentoFornitoreSuGiornoOrchestrator _pagamentoOrchestrator;

    public SpeseSuGiornoCrudTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _uow = new UnitOfWork(_dbContext);
        var chiusuraService = new ChiusuraMensileService(_dbContext, new ChiusuraMensileValidator(_dbContext));
        _syncService = new RegistroCassaSyncService(_uow);
        var docService = new DocumentiFornitoreService(_dbContext);
        var pagOrchestrator = new PagamentoFornitoreOrchestrator(_uow, _syncService);
        var eventBus = new Mock<IEventBus>();

        _spesaOrchestrator = new SpesaCassaSuGiornoOrchestrator(
            _uow, chiusuraService, _syncService, eventBus.Object);
        _pagamentoOrchestrator = new PagamentoFornitoreSuGiornoOrchestrator(
            _uow, chiusuraService, _syncService, docService, pagOrchestrator, eventBus.Object);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Helpers

    private Utente SeedUtente()
    {
        var ruolo = new Ruolo { Nome = "Cassiere", Descrizione = "Ruolo Cassiere" };
        _dbContext.Ruoli.Add(ruolo);
        _dbContext.SaveChanges();

        var utente = JwtTestHelper.CreateTestUtente(id: 0);
        utente.RuoloId = ruolo.Id;
        _dbContext.Utenti.Add(utente);
        _dbContext.SaveChanges();
        return utente;
    }

    private Fornitore SeedFornitore(string ragioneSociale = "Fornitore Test")
    {
        var fornitore = new Fornitore
        {
            RagioneSociale = ragioneSociale,
            PartitaIva = "IT12345678901",
            Attivo = true,
        };
        _dbContext.Fornitori.Add(fornitore);
        _dbContext.SaveChanges();
        return fornitore;
    }

    #endregion

    // ═══════════════════════════════════════════════════════════════
    //  SpesaCassa — CREATE
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiungiSpesaCassaSuGiorno_SenzaRegistro_CreaRegistroLeggeroERitornaId()
    {
        // Arrange — nessun registro alla data: la create deve crearne uno "leggero" DRAFT.
        var utente = SeedUtente();
        var data = new DateTime(2026, 2, 10);
        var input = new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Affitto locale",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
        };

        // Act
        var spesa = await _spesaOrchestrator.AggiungiAsync(input, utente.Id);

        // Assert — Id valorizzato e riga persistita
        spesa.Id.Should().BeGreaterThan(0);
        spesa.Descrizione.Should().Be("Affitto locale");
        spesa.Categoria.Should().Be(CategoriaSpesa.Affitto);

        // Registro leggero creato alla data
        var registro = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == spesa.RegistroCassaId);
        registro.Stato.Should().Be("DRAFT");
        registro.Data.Date.Should().Be(data.Date);

        // SpeseGiornaliere ricalcolate
        registro.SpeseGiornaliere.Should().Be(800m);
    }

    // ═══════════════════════════════════════════════════════════════
    //  SpesaCassa — UPDATE stessa data
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiornaSpesaCassaSuGiorno_StessaData_UpdateInLocoERicalcola()
    {
        // Arrange
        var utente = SeedUtente();
        var data = new DateTime(2026, 2, 12);
        var creata = await _spesaOrchestrator.AggiungiAsync(new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Spesa iniziale",
            Importo = 100m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);
        int registroId = creata.RegistroCassaId;

        // Act — stessa data, cambiano descrizione/importo/categoria
        var aggiornata = await _spesaOrchestrator.AggiornaAsync(new AggiornaSpesaCassaSuGiornoInput
        {
            SpesaId = creata.Id,
            Data = data,
            Descrizione = "Spesa aggiornata",
            Importo = 250m,
            Categoria = CategoriaSpesa.Utenze,
        }, utente.Id);

        // Assert — update in loco (stesso registro), campi cambiati, ricalcolo
        aggiornata.RegistroCassaId.Should().Be(registroId);
        aggiornata.Descrizione.Should().Be("Spesa aggiornata");
        aggiornata.Importo.Should().Be(250m);
        aggiornata.Categoria.Should().Be(CategoriaSpesa.Utenze);

        var registro = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == registroId);
        registro.SpeseGiornaliere.Should().Be(250m);

        // Nessun registro extra creato
        (await _dbContext.RegistriCassa.CountAsync()).Should().Be(1);
    }

    // ═══════════════════════════════════════════════════════════════
    //  SpesaCassa — UPDATE cambio data (spostamento + cleanup origine)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiornaSpesaCassaSuGiorno_CambioData_SpostaRigaEEliminaRegistroOrigineVuoto()
    {
        // Arrange — spesa su data1, registro leggero d'origine con la sola riga
        var utente = SeedUtente();
        var dataOrigine = new DateTime(2026, 2, 15);
        var dataDestino = new DateTime(2026, 2, 20);
        var creata = await _spesaOrchestrator.AggiungiAsync(new AggiungiSpesaCassaSuGiornoInput
        {
            Data = dataOrigine,
            Descrizione = "Spesa da spostare",
            Importo = 300m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);
        int idOrigine = creata.RegistroCassaId;

        // Act — cambio data: la riga si sposta sul registro (find-or-create) dell'altro giorno
        var aggiornata = await _spesaOrchestrator.AggiornaAsync(new AggiornaSpesaCassaSuGiornoInput
        {
            SpesaId = creata.Id,
            Data = dataDestino,
            Descrizione = "Spesa da spostare",
            Importo = 300m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);

        // Assert — la spesa vive ora sul registro di destinazione
        var registroDestino = await _dbContext.RegistriCassa
            .FirstAsync(r => r.Data.Date == dataDestino.Date);
        aggiornata.RegistroCassaId.Should().Be(registroDestino.Id);
        registroDestino.SpeseGiornaliere.Should().Be(300m);

        // Registro d'origine rimasto vuoto → auto-eliminato (cleanup, Decision 3)
        (await _dbContext.RegistriCassa.AnyAsync(r => r.Id == idOrigine)).Should().BeFalse();
        (await _dbContext.RegistriCassa.CountAsync()).Should().Be(1);
    }

    // ═══════════════════════════════════════════════════════════════
    //  SpesaCassa — DELETE
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task EliminaSpesaCassaSuGiorno_RimuoveRicalcolaEEliminaRegistroLeggeroVuoto()
    {
        // Arrange — registro leggero con la sola spesa
        var utente = SeedUtente();
        var data = new DateTime(2026, 2, 25);
        var creata = await _spesaOrchestrator.AggiungiAsync(new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Spesa da eliminare",
            Importo = 50m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);
        int registroId = creata.RegistroCassaId;

        // Act
        var esito = await _spesaOrchestrator.EliminaAsync(creata.Id);

        // Assert — riga rimossa e registro leggero vuoto auto-eliminato
        esito.Should().BeTrue();
        (await _dbContext.SpeseCassa.AnyAsync(s => s.Id == creata.Id)).Should().BeFalse();
        (await _dbContext.RegistriCassa.AnyAsync(r => r.Id == registroId)).Should().BeFalse();
    }

    // ═══════════════════════════════════════════════════════════════
    //  PagamentoFornitore — CREATE senza fornitore (tracciata semplice)
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiungiPagamentoFornitoreSuGiorno_SenzaFornitore_CreaPagamentoSempliceERicalcola()
    {
        // Arrange
        var utente = SeedUtente();
        var data = new DateTime(2026, 3, 5);
        var input = new AggiungiPagamentoFornitoreSuGiornoInput
        {
            Data = data,
            Importo = 400m,
            MetodoPagamento = "Bonifico",
            Categoria = CategoriaSpesa.Stipendi,
        };

        // Act
        var pagamento = await _pagamentoOrchestrator.AggiungiAsync(input, utente.Id);

        // Assert — pagamento tracciato semplice: nessuna fattura né DDT
        pagamento.PagamentoId.Should().BeGreaterThan(0);
        pagamento.Importo.Should().Be(400m);
        pagamento.MetodoPagamento.Should().Be("Bonifico");
        pagamento.Categoria.Should().Be(CategoriaSpesa.Stipendi);
        pagamento.FatturaId.Should().BeNull();
        pagamento.DdtId.Should().BeNull();
        pagamento.RegistroCassaId.Should().NotBeNull();

        // Nessuna fattura creata
        (await _dbContext.FattureAcquisto.AnyAsync()).Should().BeFalse();

        // SpeseFornitori ricalcolate sul registro leggero
        var registro = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == pagamento.RegistroCassaId!.Value);
        registro.Stato.Should().Be("DRAFT");
        registro.SpeseFornitori.Should().Be(400m);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PagamentoFornitore — CREATE con fornitore/fattura "FA"
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiungiPagamentoFornitoreSuGiorno_ConFornitore_CreaFatturaFACollegataSenzaDdt()
    {
        // Arrange
        var utente = SeedUtente();
        var fornitore = SeedFornitore();
        var data = new DateTime(2026, 3, 8);
        var input = new AggiungiPagamentoFornitoreSuGiornoInput
        {
            Data = data,
            Importo = 122m,
            MetodoPagamento = "Bonifico",
            FornitoreId = fornitore.FornitoreId,
            NumeroFattura = "FA-2026-001",
            DataFattura = data,
            AliquotaIva = 22m,
        };

        // Act
        var pagamento = await _pagamentoOrchestrator.AggiungiAsync(input, utente.Id);

        // Assert — pagamento collegato a una FatturaAcquisto "FA", nessun DDT
        pagamento.FatturaId.Should().NotBeNull();
        pagamento.DdtId.Should().BeNull();

        var fattura = await _dbContext.FattureAcquisto.FirstAsync(f => f.FatturaId == pagamento.FatturaId!.Value);
        fattura.FornitoreId.Should().Be(fornitore.FornitoreId);
        fattura.NumeroFattura.Should().Be("FA-2026-001");

        // Nessun documento di trasporto creato (Decision 2: DDT esclusi)
        (await _dbContext.DocumentiTrasporto.AnyAsync()).Should().BeFalse();
    }

    // ═══════════════════════════════════════════════════════════════
    //  PagamentoFornitore — DELETE
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task EliminaPagamentoFornitoreSuGiorno_RimuoveEEliminaRegistroLeggeroVuoto()
    {
        // Arrange — registro leggero con il solo pagamento
        var utente = SeedUtente();
        var data = new DateTime(2026, 3, 12);
        var pagamento = await _pagamentoOrchestrator.AggiungiAsync(new AggiungiPagamentoFornitoreSuGiornoInput
        {
            Data = data,
            Importo = 90m,
            Categoria = CategoriaSpesa.Utenze,
        }, utente.Id);
        int registroId = pagamento.RegistroCassaId!.Value;

        // Act
        var esito = await _pagamentoOrchestrator.EliminaAsync(pagamento.PagamentoId);

        // Assert — pagamento rimosso e registro leggero vuoto auto-eliminato
        esito.Should().BeTrue();
        (await _dbContext.PagamentiFornitori.AnyAsync(p => p.PagamentoId == pagamento.PagamentoId)).Should().BeFalse();
        (await _dbContext.RegistriCassa.AnyAsync(r => r.Id == registroId)).Should().BeFalse();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Guardie — GuardMeseChiuso e RECONCILED
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task AggiungiSpesaCassaSuGiorno_MeseChiuso_LanciaExecutionError()
    {
        // Arrange — mese CHIUSO sulla data target
        var utente = SeedUtente();
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = 2026, Mese = 4, Stato = "CHIUSA" });
        await _dbContext.SaveChangesAsync();

        var input = new AggiungiSpesaCassaSuGiornoInput
        {
            Data = new DateTime(2026, 4, 10),
            Descrizione = "Affitto",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
        };

        // Act & Assert
        var act = () => _spesaOrchestrator.AggiungiAsync(input, utente.Id);
        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*chiuso*");
    }

    [Fact]
    public async Task AggiungiSpesaCassaSuGiorno_RegistroReconciled_LanciaExecutionError()
    {
        // Arrange — registro RECONCILED alla data
        var utente = SeedUtente();
        var data = new DateTime(2026, 4, 15);
        _dbContext.RegistriCassa.Add(new RegistroCassa
        {
            Data = data,
            UtenteId = utente.Id,
            Stato = "RECONCILED",
        });
        await _dbContext.SaveChangesAsync();

        var input = new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Affitto",
            Importo = 800m,
            Categoria = CategoriaSpesa.Affitto,
        };

        // Act & Assert
        var act = () => _spesaOrchestrator.AggiungiAsync(input, utente.Id);
        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*riconciliato*");
    }

    [Fact]
    public async Task EliminaSpesaCassaSuGiorno_RegistroReconciled_LanciaExecutionError()
    {
        // Arrange — spesa su un registro poi passato a RECONCILED: il delete deve essere bloccato
        var utente = SeedUtente();
        var data = new DateTime(2026, 4, 18);
        var creata = await _spesaOrchestrator.AggiungiAsync(new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Spesa bloccata",
            Importo = 30m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);

        var registro = await _dbContext.RegistriCassa.FirstAsync(r => r.Id == creata.RegistroCassaId);
        registro.Stato = "RECONCILED";
        await _dbContext.SaveChangesAsync();

        // Act & Assert
        var act = () => _spesaOrchestrator.EliminaAsync(creata.Id);
        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*riconciliato*");
    }

    [Fact]
    public async Task AggiungiPagamentoFornitoreSuGiorno_MeseChiuso_LanciaExecutionError()
    {
        // Arrange — mese CHIUSO sulla data target
        var utente = SeedUtente();
        _dbContext.ChiusureMensili.Add(new ChiusuraMensile { Anno = 2026, Mese = 4, Stato = "CHIUSA" });
        await _dbContext.SaveChangesAsync();

        var input = new AggiungiPagamentoFornitoreSuGiornoInput
        {
            Data = new DateTime(2026, 4, 20),
            Importo = 100m,
            Categoria = CategoriaSpesa.Utenze,
        };

        // Act & Assert
        var act = () => _pagamentoOrchestrator.AggiungiAsync(input, utente.Id);
        await act.Should().ThrowAsync<ExecutionError>().WithMessage("*chiuso*");
    }

    // ═══════════════════════════════════════════════════════════════
    //  Cleanup — NON elimina un registro con contenuto residuo
    // ═══════════════════════════════════════════════════════════════

    [Fact]
    public async Task EliminaSpesaCassaSuGiorno_RegistroConVendite_NonEliminaIlRegistro()
    {
        // Arrange — registro con una vendita residua oltre alla spesa
        var utente = SeedUtente();
        var data = new DateTime(2026, 5, 3);
        var creata = await _spesaOrchestrator.AggiungiAsync(new AggiungiSpesaCassaSuGiornoInput
        {
            Data = data,
            Descrizione = "Spesa",
            Importo = 40m,
            Categoria = CategoriaSpesa.Altro,
        }, utente.Id);
        int registroId = creata.RegistroCassaId;

        _dbContext.Vendite.Add(new Vendita
        {
            RegistroCassaId = registroId,
            ProdottoId = 1,
            Quantita = 1m,
            PrezzoUnitario = 10m,
            PrezzoTotale = 10m,
        });
        await _dbContext.SaveChangesAsync();

        // Act — elimina l'unica spesa; il registro ha ancora una vendita
        await _spesaOrchestrator.EliminaAsync(creata.Id);

        // Assert — cleanup NON deve eliminare il registro (ha contenuto residuo)
        (await _dbContext.RegistriCassa.AnyAsync(r => r.Id == registroId)).Should().BeTrue();
        (await _dbContext.SpeseCassa.AnyAsync(s => s.Id == creata.Id)).Should().BeFalse();
    }

    [Fact]
    public async Task CleanupRegistroLeggeroVuoto_RegistroConAperturaChiusura_NonEliminaIlRegistro()
    {
        // Arrange — registro DRAFT vuoto ma con totali apertura/chiusura impostati (registro operativo)
        var utente = SeedUtente();
        var registro = new RegistroCassa
        {
            Data = new DateTime(2026, 5, 6),
            UtenteId = utente.Id,
            Stato = "DRAFT",
            TotaleApertura = 100m,
            TotaleChiusura = 150m,
        };
        _dbContext.RegistriCassa.Add(registro);
        await _dbContext.SaveChangesAsync();

        // Act
        var eliminato = await _syncService.CleanupRegistroLeggeroVuotoAsync(registro.Id);

        // Assert — apertura/chiusura impostate ⇒ non è "leggero", non va eliminato
        eliminato.Should().BeFalse();
        (await _dbContext.RegistriCassa.AnyAsync(r => r.Id == registro.Id)).Should().BeTrue();
    }
}
