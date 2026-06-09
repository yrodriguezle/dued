using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.GestioneCassa.Types;
using duedgusto.GraphQL.Fornitori.Types;

namespace duedgusto.GraphQL.GestioneCassa;

public class GestioneCassaQueries : ObjectGraphType
{
    /// <summary>Stati dei registri cassa che concorrono ai KPI contabili (esclude i DRAFT).</summary>
    private static readonly string[] StatiContabilizzati = ["CLOSED", "RECONCILED"];

    public GestioneCassaQueries()
    {
        this.Authorize();

        // Get all denominations
        Field<ListGraphType<DenominazioneMonetaType>, List<DenominazioneMoneta>>("denominazioni")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.DenominazioniMoneta
                    .OrderBy(d => d.OrdineVisualizzazione)
                    .ToListAsync();
            });

        // Get single cash register by ID
        Field<RegistroCassaType, RegistroCassa>("registroCassa")
            .Argument<NonNullGraphType<DateTimeGraphType>>("data")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                DateTime? data = context.GetArgument<DateTime?>("data");

                RegistroCassa? result = await dbContext.RegistriCassa
                      .Where(r => r.Data == data)
                      .FirstOrDefaultAsync();
                return result;
            });

        // Get dashboard KPIs
        Field<RegistroCassaKPIType, RegistroCassaKPI>("dashboardKPIs")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                DateTime today = DateTime.Today;
                var startOfMonth = new DateTime(today.Year, today.Month, 1);
                // Lunedì della settimana corrente — stessa mappatura ((DayOfWeek+6)%7)
                // di operatingDayIndex usata da guard e chiusure mensili
                DateTime startOfWeek = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
                DateTime startOfLastWeek = startOfWeek.AddDays(-7);
                DateTime sameDayLastWeek = today.AddDays(-7);

                RegistroCassa? todayRegister = await dbContext.RegistriCassa
                      .Where(r => r.Data == today)
                      .FirstOrDefaultAsync();

                // Carica dati per il mese corrente
                List<RegistroCassa> monthRegisters = await dbContext.RegistriCassa
                      .Where(r => r.Data >= startOfMonth && r.Data <= today)
                      .ToListAsync();

                // Carica dati per settimana corrente e precedente per il trend
                // (unica query sul range; filtro stato e split delle porzioni in memoria)
                List<RegistroCassa> weekRegisters = await dbContext.RegistriCassa
                      .Where(r => r.Data >= startOfLastWeek && r.Data <= today)
                      .OrderBy(r => r.Data)
                      .ToListAsync();

                // VenditeOggi/DifferenzaOggi: registro del giorno qualunque sia lo stato
                // (anche DRAFT: è il dato live di oggi)
                var todaySales = todayRegister?.TotaleVendite ?? 0;
                var todayDifference = todayRegister?.Differenza ?? 0;
                var monthSales = monthRegisters.Sum(r => r.TotaleVendite);

                // MediaMese: solo registri contabilizzati (CLOSED/RECONCILED) —
                // i DRAFT a 0 € non devono abbassare la media
                List<RegistroCassa> monthAccounted = monthRegisters
                    .Where(r => StatiContabilizzati.Contains(r.Stato))
                    .ToList();
                var monthAverage = monthAccounted.Count > 0
                    ? monthAccounted.Average(r => r.TotaleVendite)
                    : 0;

                // TrendSettimana: settimana corrente (lunedì → oggi) vs porzione equivalente
                // della settimana precedente (lunedì precedente → stesso giorno −7).
                // Solo registri CLOSED/RECONCILED.
                // Formula: trend = (corrente − precedente) / precedente × 100;
                // se la base (precedente) è 0 il trend vale 0 (guardia divisione per zero);
                // con corrente 0 e precedente > 0 il risultato è −100%.
                decimal thisWeekTotal = weekRegisters
                    .Where(r => StatiContabilizzati.Contains(r.Stato)
                        && r.Data >= startOfWeek && r.Data <= today)
                    .Sum(r => r.TotaleVendite);
                decimal lastWeekTotal = weekRegisters
                    .Where(r => StatiContabilizzati.Contains(r.Stato)
                        && r.Data >= startOfLastWeek && r.Data <= sameDayLastWeek)
                    .Sum(r => r.TotaleVendite);
                decimal weekTrend = lastWeekTotal == 0
                    ? 0
                    : (thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100;

                return new RegistroCassaKPI
                {
                    VenditeOggi = todaySales,
                    DifferenzaOggi = todayDifference,
                    VenditeMese = monthSales,
                    MediaMese = monthAverage,
                    TrendSettimana = weekTrend
                };
            });

        // Get supplier payments for a specific date
        Field<ListGraphType<PagamentoFornitoreType>, List<PagamentoFornitore>>("pagamentiFornitoriPerData")
            .Argument<NonNullGraphType<DateTimeGraphType>>("data", "Data per cui cercare i pagamenti")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                DateTime data = context.GetArgument<DateTime>("data");

                return await dbContext.PagamentiFornitori
                    .Where(p => p.DataPagamento.Date == data.Date)
                    .ToListAsync();
            });

        // Get unpaid invoices for a specific supplier
        Field<ListGraphType<FatturaAcquistoType>, List<FatturaAcquisto>>("fattureNonPagatePerFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId", "ID del fornitore")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");

                return await dbContext.FattureAcquisto
                    .Where(f => f.FornitoreId == fornitoreId)
                    .Where(f => f.Stato == "DA_PAGARE" || f.Stato == "PARZIALMENTE_PAGATA")
                    .ToListAsync();
            });

        // Get DDTs without complete payment coverage for a specific supplier
        Field<ListGraphType<DocumentoTrasportoType>, List<DocumentoTrasporto>>("ddtNonPagatiPerFornitore")
            .Argument<NonNullGraphType<IntGraphType>>("fornitoreId", "ID del fornitore")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int fornitoreId = context.GetArgument<int>("fornitoreId");

                return await dbContext.DocumentiTrasporto
                    .Where(d => d.FornitoreId == fornitoreId)
                    .Where(d => !d.Pagamenti.Any() ||
                        d.Pagamenti.Sum(p => p.Importo) < (d.Importo ?? 0))
                    .ToListAsync();
            });
    }
}

// Helper classes for pagination and KPIs
public class RegistroCassaKPI
{
    public decimal VenditeOggi { get; set; }
    public decimal DifferenzaOggi { get; set; }
    public decimal VenditeMese { get; set; }
    public decimal MediaMese { get; set; }
    public decimal TrendSettimana { get; set; }
}

public class RegistroCassaKPIType : ObjectGraphType<RegistroCassaKPI>
{
    public RegistroCassaKPIType()
    {
        Name = "RegistroCassaKPI";
        Field(x => x.VenditeOggi);
        Field(x => x.DifferenzaOggi);
        Field(x => x.VenditeMese);
        Field(x => x.MediaMese);
        Field(x => x.TrendSettimana);
    }
}
