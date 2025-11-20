using System.Data;
using System.Data.Common;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL;
using GraphQL.DataLoader;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.DataAccess;

namespace duedgusto.Services.GraphQL;

public class GraphQLService
{
    public static IServiceProvider GetServiceProvider(IResolveFieldContext<object?> context)
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("RequestServices non è disponibile.");
        }
        IServiceScope scope = context.RequestServices.CreateScope();
        return scope.ServiceProvider;
    }

    public static T GetService<T>(IResolveFieldContext<object?> context) where T : class
    {
        IServiceProvider serviceProvider = GetServiceProvider(context);
        return serviceProvider.GetRequiredService<T>();
    }

    public static async Task<Connection<T>> GetConnectionAsync<T>(
        IResolveFieldContext<object?> context,
        string? whereClause,
        string? orderByClause,
        Func<T, string> cursorSelector
    ) where T : class
    {
        AppDbContext dbContext = GetService<AppDbContext>(context);
        IDataLoaderContextAccessor dataLoaderAccessor = GetService<IDataLoaderContextAccessor>(context);
        DataLoaderContext dataLoader = dataLoaderAccessor.Context;

        int pageSize = context.GetArgument<int?>("first") ?? 10;
        int offset = context.GetArgument<int?>("cursor") ?? 0;

        // SECURITY FIX: Use LINQ instead of raw SQL to prevent SQL injection
        // whereClause and orderByClause are ignored for security reasons
        // If filtering/sorting is needed, implement specific query methods per entity

        IQueryable<T> query = dbContext.Set<T>();

        // Get total count before pagination
        int totalCount = await query.CountAsync();

        // Apply pagination using LINQ (safe from SQL injection)
        List<T> items = await query
            .Skip(offset)
            .Take(pageSize)
            .ToListAsync();

        List<Edge<T>> edges = [.. items.Select(item => new Edge<T>
        {
            Node = item,
            Cursor = cursorSelector(item)
        })];

        string? startCursor = edges.FirstOrDefault()?.Cursor;
        string? endCursor = edges.LastOrDefault()?.Cursor;

        PageInfo pageInfo = new()
        {
            StartCursor = startCursor,
            EndCursor = endCursor,
            HasNextPage = (offset + pageSize) < totalCount,
            HasPreviousPage = offset > 0
        };

        Connection<T> connectionResult = new()
        {
            Edges = edges,
            PageInfo = pageInfo,
            TotalCount = totalCount
        };

        return connectionResult;
    }
}
