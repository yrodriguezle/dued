using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Neutralizza le default MySQL-only del modello, così che <c>EnsureCreated()</c> possa emettere
/// la <c>CREATE TABLE</c> su Sqlite.
///
/// <para><b>Il guasto che risolve.</b> <see cref="duedgusto.DataAccess.AppDbContext"/> configura
/// <c>HasDefaultValueSql("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")</c> su 14 entità
/// (<c>RegistroCassa</c>, <c>Vendita</c>, <c>Prodotto</c>, <c>Fornitore</c>, …). Quella è sintassi
/// MySQL, ed <c>EnsureCreated()</c> la riversa <b>dentro</b> la <c>CREATE TABLE</c>: Sqlite la
/// rifiuta e la factory non parte affatto. Non è un dettaglio estetico — senza questa
/// neutralizzazione non esiste nessun test Sqlite.</para>
///
/// <para><b>Perché un <see cref="IModelCustomizer"/> e non un ramo <c>if (Database.IsSqlite())</c>
/// in <c>OnModelCreating</c>.</b> Due ragioni, la seconda più importante della prima:
/// <list type="number">
///   <item>non tocca il codice di produzione — <c>AppDbContext</c> resta un modello MySQL puro, e
///   nessuno leggendolo deve chiedersi quale ramo valga a runtime;</item>
///   <item><b>è generico invece che enumerativo</b>: spazza l'intero modello cercando
///   <c>DefaultValueSql</c>, quindi copre da solo le entità che questo change deve ancora
///   aggiungere (<c>Ordine</c>, <c>RigaOrdine</c>, <c>GruppoProdotti</c>). Un ramo condizionale
///   andrebbe invece esteso a mano a ogni entità nuova, e chi se ne dimenticasse scoprirebbe il
///   guasto solo quando la factory smette di partire.</item>
/// </list></para>
///
/// <para>⚠️ <b>Effetto collaterale accettato.</b> Insieme alla default si azzera anche il
/// <see cref="ValueGenerated"/> che <c>HasDefaultValueSql</c> impone. Se non lo si facesse, EF
/// continuerebbe a considerare <c>CreatedAt</c>/<c>UpdatedAt</c> generate dal database e le
/// ometterebbe dalla INSERT — su Sqlite, senza più una default, la colonna resterebbe NULL e la
/// rilettura di un <c>DateTime</c> non nullable fallirebbe. Con <see cref="ValueGenerated.Never"/>
/// quelle colonne diventano colonne normali: vale ciò che scrive l'applicazione. Un test Sqlite
/// non deve quindi aspettarsi timestamp riempiti dal database.</para>
///
/// <para>ℹ️ <c>HasCharSet("utf8mb4")</c> e le collation Pomelo sono invece annotazioni che il
/// provider Sqlite ignora senza danni: non vanno toccate.</para>
/// </summary>
internal sealed class SqliteTestModelCustomizer : RelationalModelCustomizer
{
    public SqliteTestModelCustomizer(ModelCustomizerDependencies dependencies)
        : base(dependencies)
    {
    }

    public override void Customize(ModelBuilder modelBuilder, DbContext context)
    {
        // base.Customize esegue AppDbContext.OnModelCreating: il modello va ripulito DOPO,
        // altrimenti non c'è ancora nulla da ripulire.
        base.Customize(modelBuilder, context);

        foreach (var proprieta in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetProperties()))
        {
            if (proprieta.GetDefaultValueSql() is null)
            {
                continue;
            }

            proprieta.SetDefaultValueSql(null);
            proprieta.ValueGenerated = ValueGenerated.Never;
        }
    }
}
