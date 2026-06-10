using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;

using FluentAssertions.Specialized;

using DuedGusto.Tests.Helpers;
using duedgusto.Repositories.Implementations;

namespace DuedGusto.Tests.Unit.Repositories;

/// <summary>
/// Tests per IUnitOfWork.ExecuteInTransactionAsync (design qualita-fase4, Decisione 1).
/// Semantica: begin → operation → commit; su eccezione: rollback + rethrow (eccezione
/// originale, non wrappata); se una transazione è già attiva sul DbContext
/// (CurrentTransaction != null) l'operazione viene eseguita direttamente (passthrough).
///
/// Nota provider: InMemory non supporta transazioni reali (rollback no-op,
/// CurrentTransaction sempre null), quindi il ciclo di vita della transazione
/// (commit/rollback/passthrough) è verificato con mock di DatabaseFacade +
/// IDbContextTransaction; la persistenza del percorso commit è verificata con
/// il provider InMemory reale via TestDbContextFactory.
/// </summary>
public class UnitOfWorkExecuteInTransactionTests
{
    #region Helpers

    private static Mock<IDbContextTransaction> CreateTransactionMock()
    {
        var transaction = new Mock<IDbContextTransaction>();
        transaction.Setup(t => t.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        transaction.Setup(t => t.RollbackAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        transaction.Setup(t => t.DisposeAsync()).Returns(ValueTask.CompletedTask);
        return transaction;
    }

    /// <summary>
    /// AppDbContext con DatabaseFacade mockata per osservare BeginTransactionAsync /
    /// CurrentTransaction senza un provider relazionale.
    /// </summary>
    private static (UnitOfWork UnitOfWork, Mock<DatabaseFacade> Facade) CreateUnitOfWorkWithMockedFacade(
        IDbContextTransaction? currentTransaction,
        IDbContextTransaction? beginResult = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var configMock = new Mock<IConfiguration>();
        var contextMock = new Mock<AppDbContext>(options, configMock.Object) { CallBase = true };

        var facadeMock = new Mock<DatabaseFacade>(contextMock.Object);
        facadeMock.SetupGet(f => f.CurrentTransaction).Returns(currentTransaction);
        if (beginResult != null)
        {
            facadeMock
                .Setup(f => f.BeginTransactionAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(beginResult);
        }

        contextMock.SetupGet(c => c.Database).Returns(facadeMock.Object);

        return (new UnitOfWork(contextMock.Object), facadeMock);
    }

    #endregion

    #region Commit al completamento del delegato

    [Fact]
    public async Task ExecuteInTransactionAsync_SuccessoConProviderReale_PersisteERestituisceIlRisultato()
    {
        // Arrange — provider InMemory reale: esercita il code path completo dell'helper
        using AppDbContext dbContext = TestDbContextFactory.Create();
        using var unitOfWork = new UnitOfWork(dbContext);

        // Act
        Fornitore result = await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var fornitore = new Fornitore { RagioneSociale = "Fornitore Transazionale" };
            unitOfWork.Fornitori.Add(fornitore);
            await unitOfWork.SaveChangesAsync();
            return fornitore;
        });

        // Assert — valore di ritorno del delegato restituito al chiamante + scritture persistite
        result.Should().NotBeNull();
        result.FornitoreId.Should().BeGreaterThan(0);
        (await dbContext.Fornitori.CountAsync(f => f.RagioneSociale == "Fornitore Transazionale"))
            .Should().Be(1);
    }

    [Fact]
    public async Task ExecuteInTransactionAsync_Successo_CommittaLaTransazioneUnaSolaVolta()
    {
        // Arrange
        Mock<IDbContextTransaction> transaction = CreateTransactionMock();
        (UnitOfWork unitOfWork, Mock<DatabaseFacade> facade) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: null, beginResult: transaction.Object);

        // Act
        int result = await unitOfWork.ExecuteInTransactionAsync(() => Task.FromResult(42));

        // Assert
        result.Should().Be(42);
        facade.Verify(f => f.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteInTransactionAsync_OverloadVoid_EsegueLOperazioneECommitta()
    {
        // Arrange
        Mock<IDbContextTransaction> transaction = CreateTransactionMock();
        (UnitOfWork unitOfWork, Mock<DatabaseFacade> facade) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: null, beginResult: transaction.Object);
        bool eseguito = false;

        // Act
        await unitOfWork.ExecuteInTransactionAsync(() =>
        {
            eseguito = true;
            return Task.CompletedTask;
        });

        // Assert
        eseguito.Should().BeTrue();
        facade.Verify(f => f.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion

    #region Rollback su eccezione con stato pulito

    [Fact]
    public async Task ExecuteInTransactionAsync_Eccezione_RollbackEPropagaEccezioneOriginaleNonWrappata()
    {
        // Arrange
        Mock<IDbContextTransaction> transaction = CreateTransactionMock();
        (UnitOfWork unitOfWork, Mock<DatabaseFacade> facade) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: null, beginResult: transaction.Object);
        var originale = new InvalidOperationException("errore nel delegato");

        // Act
        Func<Task> act = () => unitOfWork.ExecuteInTransactionAsync<int>(() => throw originale);

        // Assert — stessa ISTANZA di eccezione (stesso tipo e messaggio, non wrappata)
        ExceptionAssertions<InvalidOperationException> thrown =
            await act.Should().ThrowAsync<InvalidOperationException>();
        thrown.Which.Should().BeSameAs(originale);

        transaction.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteInTransactionAsync_OverloadVoid_EccezionePropagataConRollback()
    {
        // Arrange
        Mock<IDbContextTransaction> transaction = CreateTransactionMock();
        (UnitOfWork unitOfWork, _) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: null, beginResult: transaction.Object);
        var originale = new ArgumentException("errore overload void");

        // Act
        Func<Task> act = () => unitOfWork.ExecuteInTransactionAsync(() => throw originale);

        // Assert
        ExceptionAssertions<ArgumentException> thrown =
            await act.Should().ThrowAsync<ArgumentException>();
        thrown.Which.Should().BeSameAs(originale);
        transaction.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Once);
        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion

    #region Passthrough con transazione ambient già attiva

    [Fact]
    public async Task ExecuteInTransactionAsync_TransazioneAmbientAttiva_EsegueSenzaAnnidare()
    {
        // Arrange — CurrentTransaction != null: l'helper NON deve aprire una nuova transazione
        Mock<IDbContextTransaction> ambient = CreateTransactionMock();
        (UnitOfWork unitOfWork, Mock<DatabaseFacade> facade) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: ambient.Object);

        // Act
        string result = await unitOfWork.ExecuteInTransactionAsync(() => Task.FromResult("ambient"));

        // Assert — passthrough: nessun begin/commit/rollback (governa la transazione esterna)
        result.Should().Be("ambient");
        facade.Verify(f => f.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        ambient.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
        ambient.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteInTransactionAsync_TransazioneAmbientAttiva_EccezionePropagataSenzaRollback()
    {
        // Arrange — su eccezione nel passthrough, commit/rollback restano al chiamante esterno
        Mock<IDbContextTransaction> ambient = CreateTransactionMock();
        (UnitOfWork unitOfWork, Mock<DatabaseFacade> facade) =
            CreateUnitOfWorkWithMockedFacade(currentTransaction: ambient.Object);
        var originale = new InvalidOperationException("errore dentro transazione ambient");

        // Act
        Func<Task> act = () => unitOfWork.ExecuteInTransactionAsync<int>(() => throw originale);

        // Assert
        ExceptionAssertions<InvalidOperationException> thrown =
            await act.Should().ThrowAsync<InvalidOperationException>();
        thrown.Which.Should().BeSameAs(originale);
        facade.Verify(f => f.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        ambient.Verify(t => t.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion
}
