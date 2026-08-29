using DuedGusto.Tests.Helpers;

using GraphQL;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Diagnostics;

using duedgusto.Common;

namespace DuedGusto.Tests.Integration;

/// <summary>
/// Il progressivo dell'ordine: quel numero è ciò che si stampa sul ticket e ciò con cui si chiama
/// il cliente al bancone.
///
/// <para>🔴 <b>L'indice unico è la correttezza; il retry è l'ergonomia.</b> Non è una gerarchia
/// accademica: <c>MAX(Numero)+1</c> ha una corsa — due operatori che aprono nello stesso istante
/// leggono lo stesso massimo — e senza l'indice la collisione sarebbe <b>muta</b>. Due ticket
/// stampati identici, e ce ne si accorge quando qualcuno incassa quello sbagliato. Con l'indice
/// diventa un insert fallito, e il retry serve solo a far vedere all'operatore un ordine nuovo
/// invece di un errore.</para>
///
/// <para>Tutto su <b>Sqlite</b> perché InMemory non applica gli indici unici: un test sulla corsa
/// scritto lì sarebbe verde qualunque cosa faccia il codice, cioè peggio di non averlo.</para>
/// </summary>
public class OrdiniNumerazioneTests
{
    [Fact]
    public async Task IlProgressivoRipartaDaUnoSuOgniRegistro()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa ieri = ScenarioOrdini.SeminaRegistro(db, utente, new DateTime(2026, 8, 25));
        RegistroCassa oggi = ScenarioOrdini.SeminaRegistro(db, utente, new DateTime(2026, 8, 26));

        var apertura = ScenarioOrdini.Apertura(db);

        (await apertura.ExecuteAsync(ieri.Id, utente.Id)).Numero.Should().Be(1);
        (await apertura.ExecuteAsync(ieri.Id, utente.Id)).Numero.Should().Be(2);
        (await apertura.ExecuteAsync(oggi.Id, utente.Id)).Numero.Should().Be(1,
            "i numeri ricominciano ogni giorno, perché è così che si leggono su un ticket");
        (await apertura.ExecuteAsync(oggi.Id, utente.Id)).Numero.Should().Be(2);
    }

    [Fact]
    public async Task DueOrdiniConLaStessaTerna_IlSecondoVieneRifiutatoDalDatabase()
    {
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var db = TestDbContextFactory.CreateSqlite(connessione);

        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente);

        db.Ordini.Add(new Ordine { RegistroCassaId = registro.Id, Numero = 1, SuffissoSplit = string.Empty });
        await db.SaveChangesAsync();

        using var secondo = TestDbContextFactory.CreateSqlite(connessione);
        secondo.Ordini.Add(new Ordine { RegistroCassaId = registro.Id, Numero = 1, SuffissoSplit = string.Empty });

        var eccezione = await Assert.ThrowsAsync<DbUpdateException>(() => secondo.SaveChangesAsync());
        eccezione.InnerException.Should().BeOfType<SqliteException>();

        // 🔴 La stringa vuota ENTRA nella chiave, ed è il punto: con la colonna nullable questi due
        //    ordini avrebbero (registro, 1, NULL) entrambi, e più NULL non collidono mai fra loro.
        //    L'indice smetterebbe di proteggere proprio il caso normale, l'ordine non splittato.
        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task QuandoIlNumeroVienePresoDaUnAltroOperatore_LApertura_RitentaEVaABuonFine()
    {
        // La corsa non si riproduce chiamando due volte apriOrdine: la finestra sta DENTRO il
        // metodo, fra la lettura del massimo e la scrittura. Un interceptor la apre a comando —
        // un secondo operatore si infila proprio lì e prende il numero 1 — e il test smette di
        // dipendere dal tempismo.
        using var connessione = TestDbContextFactory.CreateSqliteConnection();
        using var semina = TestDbContextFactory.CreateSqlite(connessione);

        Utente utente = ScenarioOrdini.SeminaUtente(semina, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(semina, utente);

        var intruso = new UnAltroOperatorePrendeIlNumero(connessione, registro.Id, numero: 1);
        using var db = TestDbContextFactory.CreateSqlite(connessione, intruso);

        Ordine ordine = await ScenarioOrdini.Apertura(db).ExecuteAsync(registro.Id, utente.Id);

        intruso.HaColpito.Should().BeTrue("altrimenti il test non ha provato la corsa, solo l'apertura");
        ordine.Numero.Should().Be(2, "il primo tentativo ha trovato il numero già preso e ne ha chiesto un altro");
        ordine.Stato.Should().Be(StatiOrdine.Aperto);

        using var lettura = TestDbContextFactory.CreateSqlite(connessione);
        (await lettura.Ordini.CountAsync()).Should().Be(2, "quello dell'intruso e quello ritentato");
        (await lettura.Ordini.Select(o => o.Numero).ToListAsync()).Should().BeEquivalentTo(new[] { 1, 2 });
    }

    [Fact]
    public async Task ApriOrdine_SuUnRegistroGiaChiuso_Rifiutato()
    {
        using var db = TestDbContextFactory.Create();

        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(db, utente, stato: "CLOSED");

        var errore = await Assert.ThrowsAsync<ExecutionError>(
            () => ScenarioOrdini.Apertura(db).ExecuteAsync(registro.Id, utente.Id));

        errore.Message.Should().Contain("già chiuso");
        (await db.Ordini.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApriOrdine_NonToccaAlcunCampoDelRegistro()
    {
        using var db = TestDbContextFactory.Create();

        Utente utente = ScenarioOrdini.SeminaUtente(db, amministratore: false, "Cassiere");
        RegistroCassa registro = ScenarioOrdini.SeminaRegistro(
            db, utente, incassiElettronici: 40.00m, incassoContanteTracciato: 15.00m);

        await ScenarioOrdini.Apertura(db).ExecuteAsync(registro.Id, utente.Id);

        db.ChangeTracker.Clear();
        RegistroCassa riletto = await db.RegistriCassa.SingleAsync();
        riletto.IncassiElettronici.Should().Be(40.00m);
        riletto.IncassoContanteTracciato.Should().Be(15.00m);
        riletto.VenditeContanti.Should().Be(0m);
        (await db.RegistriCassaIva.CountAsync()).Should().Be(0);
    }

    /// <summary>
    /// Si infila una volta sola, alla prima scrittura del contesto sorvegliato, e prende il numero
    /// che quel contesto ha appena deciso di usare. È l'unico modo deterministico di riprodurre una
    /// corsa che in produzione dipende dal caso.
    /// </summary>
    private sealed class UnAltroOperatorePrendeIlNumero : SaveChangesInterceptor
    {
        private readonly SqliteConnection _connessione;
        private readonly int _registroCassaId;
        private readonly int _numero;

        public UnAltroOperatorePrendeIlNumero(SqliteConnection connessione, int registroCassaId, int numero)
        {
            _connessione = connessione;
            _registroCassaId = registroCassaId;
            _numero = numero;
        }

        public bool HaColpito { get; private set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (!HaColpito)
            {
                HaColpito = true;

                using AppDbContext altroDispositivo = TestDbContextFactory.CreateSqlite(_connessione);
                altroDispositivo.Ordini.Add(new Ordine
                {
                    RegistroCassaId = _registroCassaId,
                    Numero = _numero,
                    SuffissoSplit = string.Empty,
                    Stato = StatiOrdine.Aperto,
                });
                await altroDispositivo.SaveChangesAsync(cancellationToken);
            }

            return result;
        }
    }
}
