using Microsoft.EntityFrameworkCore;

using GraphQL;
using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.GraphQL;
using duedgusto.DataAccess;

namespace duedgusto.GraphQL.CashManagement;

public class CashManagementQueries : ObjectGraphType
{
    public CashManagementQueries()
    {
        this.Authorize();

        // Get all denominations
        Field<ListGraphType<CashDenominationType>, List<CashDenomination>>("denominations")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                return await dbContext.CashDenominations
                    .OrderBy(d => d.DisplayOrder)
                    .ToListAsync();
            });

        // Get single cash register by ID
        Field<CashRegisterType, CashRegister>("cashRegister")
            .Argument<NonNullGraphType<IntGraphType>>("registerId")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                int registerId = context.GetArgument<int>("registerId");

                return await dbContext.CashRegisters
                    .Include(r => r.User)
                        .ThenInclude(u => u.Role)
                    .Include(r => r.CashCounts)
                        .ThenInclude(c => c.Denomination)
                    .FirstOrDefaultAsync(r => r.RegisterId == registerId);
            });

        // Get cash registers with relay-style pagination
        Field<NonNullGraphType<CashRegisterConnectionType>>("cashRegistersConnection")
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

                var query = dbContext.CashRegisters
                    .Include(r => r.User)
                        .ThenInclude(u => u.Role)
                    .Include(r => r.CashCounts)
                        .ThenInclude(c => c.Denomination)
                    .AsQueryable();

                // Apply cursor pagination
                if (after.HasValue)
                {
                    query = query.Where(r => r.RegisterId > after.Value);
                }

                // Apply ordering (default by Date DESC)
                query = !string.IsNullOrEmpty(order)
                    ? query.OrderByDescending(r => r.Date)
                    : query.OrderByDescending(r => r.Date);

                var totalCount = await query.CountAsync();
                var items = await query.Take(first).ToListAsync();

                var pageInfo = new CashPageInfo
                {
                    HasNextPage = items.Count == first,
                    EndCursor = items.LastOrDefault()?.RegisterId.ToString(),
                    HasPreviousPage = after.HasValue,
                    StartCursor = items.FirstOrDefault()?.RegisterId.ToString()
                };

                return new CashRegisterConnection
                {
                    TotalCount = totalCount,
                    PageInfo = pageInfo,
                    Items = items
                };
            });

        // Get dashboard KPIs
        Field<CashRegisterKPIType, CashRegisterKPI>("dashboardKPIs")
            .ResolveAsync(async context =>
            {
                AppDbContext dbContext = GraphQLService.GetService<AppDbContext>(context);
                var today = DateTime.Today;
                var startOfMonth = new DateTime(today.Year, today.Month, 1);
                var startOfWeek = today.AddDays(-(int)today.DayOfWeek);

                var todayRegister = await dbContext.CashRegisters
                    .Where(r => r.Date == today)
                    .FirstOrDefaultAsync();

                var monthRegisters = await dbContext.CashRegisters
                    .Where(r => r.Date >= startOfMonth && r.Date <= today)
                    .ToListAsync();

                var weekRegisters = await dbContext.CashRegisters
                    .Where(r => r.Date >= startOfWeek && r.Date <= today)
                    .OrderBy(r => r.Date)
                    .ToListAsync();

                var todaySales = todayRegister?.TotalSales ?? 0;
                var todayDifference = todayRegister?.Difference ?? 0;
                var monthSales = monthRegisters.Sum(r => r.TotalSales);
                var monthAverage = monthRegisters.Any() ? monthRegisters.Average(r => r.TotalSales) : 0;

                // Calculate week trend (simple: compare this week to last week)
                decimal weekTrend = 0;
                if (weekRegisters.Count > 1)
                {
                    var thisWeekTotal = weekRegisters.TakeLast(3).Sum(r => r.TotalSales);
                    var lastWeekTotal = weekRegisters.Take(weekRegisters.Count - 3).Sum(r => r.TotalSales);
                    if (lastWeekTotal > 0)
                    {
                        weekTrend = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
                    }
                }

                return new CashRegisterKPI
                {
                    TodaySales = todaySales,
                    TodayDifference = todayDifference,
                    MonthSales = monthSales,
                    MonthAverage = monthAverage,
                    WeekTrend = weekTrend
                };
            });
    }
}

// Helper classes for pagination and KPIs
public class CashPageInfo
{
    public bool HasNextPage { get; set; }
    public string? EndCursor { get; set; }
    public bool HasPreviousPage { get; set; }
    public string? StartCursor { get; set; }
}

public class CashPageInfoType : ObjectGraphType<CashPageInfo>
{
    public CashPageInfoType()
    {
        Name = "CashPageInfo";
        Field(x => x.HasNextPage);
        Field(x => x.EndCursor, nullable: true);
        Field(x => x.HasPreviousPage);
        Field(x => x.StartCursor, nullable: true);
    }
}

public class CashRegisterConnection
{
    public int TotalCount { get; set; }
    public CashPageInfo PageInfo { get; set; } = new();
    public List<CashRegister> Items { get; set; } = new();
}

public class CashRegisterConnectionType : ObjectGraphType<CashRegisterConnection>
{
    public CashRegisterConnectionType()
    {
        Name = "CashRegisterConnection";
        Field(x => x.TotalCount);
        Field<CashPageInfoType, CashPageInfo>("pageInfo").Resolve(context => context.Source.PageInfo);
        Field<ListGraphType<CashRegisterType>, List<CashRegister>>("items").Resolve(context => context.Source.Items);
    }
}

public class CashRegisterKPI
{
    public decimal TodaySales { get; set; }
    public decimal TodayDifference { get; set; }
    public decimal MonthSales { get; set; }
    public decimal MonthAverage { get; set; }
    public decimal WeekTrend { get; set; }
}

public class CashRegisterKPIType : ObjectGraphType<CashRegisterKPI>
{
    public CashRegisterKPIType()
    {
        Field(x => x.TodaySales);
        Field(x => x.TodayDifference);
        Field(x => x.MonthSales);
        Field(x => x.MonthAverage);
        Field(x => x.WeekTrend);
    }
}
