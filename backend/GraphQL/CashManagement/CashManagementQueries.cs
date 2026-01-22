using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;
using duedgusto.GraphQL.CashManagement.Types;

namespace duedgusto.GraphQL.CashManagement;

public class CashManagementQueries : ObjectGraphType
{
    public CashManagementQueries()
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

                var result = await dbContext.RegistriCassa
                    .Include(r => r.Utente)
                        .ThenInclude(u => u.Ruolo)
                    .Include(r => r.ConteggiMoneta)
                        .ThenInclude(c => c.Denominazione)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .Where(r => r.Data == data)
                    .FirstOrDefaultAsync();
                return result;
            });

        // Get cash registers with relay-style pagination
        Field<NonNullGraphType<RegistroCassaConnectionType>>("registriCassaConnection")
            .Argument<IntGraphType>("first", "Number of items to return")
            .Argument<StringGraphType>("where", "Filter condition")
            .Argument<StringGraphType>("order", "Order by clause")
            .Argument<IntGraphType>("after", "Cursor for pagination")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);

                int first = context.GetArgument<int>("first", 20);
                string? where = context.GetArgument<string?>("where");
                string? order = context.GetArgument<string?>("order");
                int? after = context.GetArgument<int?>("after");

                var query = dbContext.RegistriCassa
                    .Include(r => r.Utente)
                        .ThenInclude(u => u.Ruolo)
                    .Include(r => r.ConteggiMoneta)
                        .ThenInclude(c => c.Denominazione)
                    .Include(r => r.IncassiCassa)
                    .Include(r => r.SpeseCassa)
                    .AsQueryable();

                // Apply cursor pagination
                if (after.HasValue)
                {
                    query = query.Where(r => r.Id > after.Value);
                }

                // Apply ordering (default by Data DESC)
                query = !string.IsNullOrEmpty(order)
                    ? query.OrderByDescending(r => r.Data)
                    : query.OrderByDescending(r => r.Data);

                var totalCount = await query.CountAsync();
                var items = await query.Take(first).ToListAsync();

                var pageInfo = new PaginazioneCassaInfo
                {
                    HaProssimaPagina = items.Count == first,
                    CursoreFine = items.LastOrDefault()?.Id.ToString(),
                    HaPaginaPrecedente = after.HasValue,
                    CursoreInizio = items.FirstOrDefault()?.Id.ToString()
                };

                return new RegistroCassaConnection
                {
                    ConteggioTotale = totalCount,
                    InfoPaginazione = pageInfo,
                    Elementi = items
                };
            });

        // Get dashboard KPIs
        Field<RegistroCassaKPIType, RegistroCassaKPI>("dashboardKPIs")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var today = DateTime.Today;
                var startOfMonth = new DateTime(today.Year, today.Month, 1);
                var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
                var startOfLastWeek = startOfWeek.AddDays(-7);

                var todayRegister = await dbContext.RegistriCassa
                    .Where(r => r.Data == today)
                    .FirstOrDefaultAsync();

                // Carica dati per il mese corrente
                var monthRegisters = await dbContext.RegistriCassa
                    .Where(r => r.Data >= startOfMonth && r.Data <= today)
                    .ToListAsync();

                // Carica dati per settimana corrente e precedente per il trend
                var weekRegisters = await dbContext.RegistriCassa
                    .Where(r => r.Data >= startOfLastWeek && r.Data <= today)
                    .OrderBy(r => r.Data)
                    .ToListAsync();

                var todaySales = todayRegister?.TotaleVendite ?? 0;
                var todayDifference = todayRegister?.Differenza ?? 0;
                var monthSales = monthRegisters.Sum(r => r.TotaleVendite);
                var monthAverage = monthRegisters.Any() ? monthRegisters.Average(r => r.TotaleVendite) : 0;

                // Calculate week trend (simple: compare this week to last week)
                decimal weekTrend = 0;
                if (weekRegisters.Count > 1)
                {
                    var thisWeekTotal = weekRegisters.TakeLast(3).Sum(r => r.TotaleVendite);
                    var lastWeekTotal = weekRegisters.Take(weekRegisters.Count - 3).Sum(r => r.TotaleVendite);
                    if (lastWeekTotal > 0)
                    {
                        weekTrend = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
                    }
                }

                return new RegistroCassaKPI
                {
                    VenditeOggi = todaySales,
                    DifferenzaOggi = todayDifference,
                    VenditeMese = monthSales,
                    MediaMese = monthAverage,
                    TrendSettimana = weekTrend
                };
            });
    }
}

// Helper classes for pagination and KPIs
public class PaginazioneCassaInfo
{
    public bool HaProssimaPagina { get; set; }
    public string? CursoreFine { get; set; }
    public bool HaPaginaPrecedente { get; set; }
    public string? CursoreInizio { get; set; }
}

public class PaginazioneCassaInfoType : ObjectGraphType<PaginazioneCassaInfo>
{
    public PaginazioneCassaInfoType()
    {
        Name = "PaginazioneCassaInfo";
        Field(x => x.HaProssimaPagina);
        Field(x => x.CursoreFine, nullable: true);
        Field(x => x.HaPaginaPrecedente);
        Field(x => x.CursoreInizio, nullable: true);
    }
}

public class RegistroCassaConnection
{
    public int ConteggioTotale { get; set; }
    public PaginazioneCassaInfo InfoPaginazione { get; set; } = new();
    public List<RegistroCassa> Elementi { get; set; } = new();
}

public class RegistroCassaConnectionType : ObjectGraphType<RegistroCassaConnection>
{
    public RegistroCassaConnectionType()
    {
        Name = "RegistroCassaPagedConnection";
        Field(x => x.ConteggioTotale);
        Field<PaginazioneCassaInfoType, PaginazioneCassaInfo>("infoPaginazione").Resolve(context => context.Source.InfoPaginazione);
        Field<ListGraphType<RegistroCassaType>, List<RegistroCassa>>("elementi").Resolve(context => context.Source.Elementi);
    }
}

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
