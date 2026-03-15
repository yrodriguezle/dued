using System.Data;
using System.Data.Common;
using System.Linq.Expressions;
using System.Text.RegularExpressions;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL;
using GraphQL.DataLoader;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.DataAccess;
using duedgusto.Models;

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

        // Support both 'after' (Relay standard string cursor) and 'cursor' (legacy int offset)
        int offset = 0;
        string? afterCursor = context.GetArgument<string?>("after");
        if (!string.IsNullOrEmpty(afterCursor) && int.TryParse(afterCursor, out int parsedAfter))
        {
            offset = parsedAfter;
        }
        else
        {
            offset = context.GetArgument<int?>("cursor") ?? 0;
        }

        IQueryable<T> query = dbContext.Set<T>();

        // Apply LIKE-based filtering safely using LINQ expressions (no raw SQL)
        if (!string.IsNullOrEmpty(whereClause))
        {
            query = ApplyLikeWhereClause(query, whereClause);
        }

        // Get total count after filtering but before pagination
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

    // Overload that accepts a query configurator for complex queries with includes
    public static async Task<Connection<T>> GetConnectionAsync<T>(
        IResolveFieldContext<object?> context,
        string? whereClause,
        string? orderByClause,
        Func<T, string> cursorSelector,
        Func<IQueryable<T>, IQueryable<T>> queryConfigurator
    ) where T : class
    {
        AppDbContext dbContext = GetService<AppDbContext>(context);
        IDataLoaderContextAccessor dataLoaderAccessor = GetService<IDataLoaderContextAccessor>(context);
        DataLoaderContext dataLoader = dataLoaderAccessor.Context;

        int pageSize = context.GetArgument<int?>("first") ?? 10;

        // Support both 'after' (Relay standard string cursor) and 'cursor' (legacy int offset)
        int offset = 0;
        string? afterCursor = context.GetArgument<string?>("after");
        if (!string.IsNullOrEmpty(afterCursor) && int.TryParse(afterCursor, out int parsedAfter))
        {
            offset = parsedAfter;
        }
        else
        {
            offset = context.GetArgument<int?>("cursor") ?? 0;
        }

        // Start with base query
        IQueryable<T> query = dbContext.Set<T>();

        // Apply query configurator (includes, custom filtering, etc.)
        query = queryConfigurator(query);

        // Apply LIKE-based filtering safely using LINQ expressions (no raw SQL)
        // This runs after queryConfigurator so custom parsers can handle their own WHERE
        if (!string.IsNullOrEmpty(whereClause))
        {
            query = ApplyLikeWhereClause(query, whereClause);
        }

        // Get total count after filtering but before pagination
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

    /// <summary>
    /// Generic LIKE WHERE clause parser. Converts frontend LIKE patterns into safe LINQ expressions.
    /// Supports: "table.field LIKE "%value%"" and multiple conditions joined by AND.
    /// Safe from SQL injection: uses Expression trees that EF Core translates to parameterized SQL.
    /// </summary>
    private static IQueryable<T> ApplyLikeWhereClause<T>(IQueryable<T> query, string whereClause) where T : class
    {
        var conditions = whereClause.Split(new[] { " AND ", " and " }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var condition in conditions)
        {
            var trimmed = condition.Trim().Trim('(', ')').Trim();

            // Match pattern: "tableName.fieldName LIKE "%value%""
            var likeMatch = Regex.Match(trimmed, @"(\w+)\.(\w+)\s+LIKE\s+""%(.+?)%""", RegexOptions.IgnoreCase);

            if (!likeMatch.Success) continue;

            var fieldName = likeMatch.Groups[2].Value;
            var searchValue = likeMatch.Groups[3].Value;

            // Find property on entity (case-insensitive match)
            var property = typeof(T).GetProperties()
                .FirstOrDefault(p => string.Equals(p.Name, fieldName, StringComparison.OrdinalIgnoreCase));

            if (property == null || property.PropertyType != typeof(string)) continue;

            // Build: entity => entity.Property != null && entity.Property.Contains(searchValue)
            var parameter = Expression.Parameter(typeof(T), "e");
            var propertyAccess = Expression.Property(parameter, property);
            var nullCheck = Expression.NotEqual(propertyAccess, Expression.Constant(null, typeof(string)));
            var searchConstant = Expression.Constant(searchValue, typeof(string));
            var containsMethod = typeof(string).GetMethod("Contains", new[] { typeof(string) })!;
            var containsCall = Expression.Call(propertyAccess, containsMethod, searchConstant);
            var combined = Expression.AndAlso(nullCheck, containsCall);
            var lambda = Expression.Lambda<Func<T, bool>>(combined, parameter);

            query = query.Where(lambda);
        }

        return query;
    }

    // Safe WHERE clause parser for RegistroCassa queries
    private static IQueryable<RegistroCassa> ApplyRegistroCassaWhereClause(IQueryable<RegistroCassa> query, string whereClause)
    {
        var parts = whereClause.Split(new[] { " AND ", " and " }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var part in parts)
        {
            var trimmedPart = part.Trim();

            if (trimmedPart.StartsWith("data >=") || trimmedPart.StartsWith("date >="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data >= date);
                }
            }
            else if (trimmedPart.StartsWith("data <=") || trimmedPart.StartsWith("date <="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data <= date);
                }
            }
            else if (trimmedPart.StartsWith("data >") || trimmedPart.StartsWith("date >"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data > date);
                }
            }
            else if (trimmedPart.StartsWith("data <") || trimmedPart.StartsWith("date <"))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data < date);
                }
            }
            else if (trimmedPart.StartsWith("data =") || trimmedPart.StartsWith("date ="))
            {
                var dateStr = ExtractDateValue(trimmedPart);
                if (DateTime.TryParse(dateStr, out DateTime date))
                {
                    query = query.Where(r => r.Data == date);
                }
            }
        }

        return query;
    }

    private static string ExtractDateValue(string condition)
    {
        var startIndex = condition.IndexOf('\'');
        if (startIndex >= 0)
        {
            var endIndex = condition.IndexOf('\'', startIndex + 1);
            if (endIndex > startIndex)
            {
                return condition.Substring(startIndex + 1, endIndex - startIndex - 1);
            }
        }
        return string.Empty;
    }

    private static IQueryable<RegistroCassa> ApplyRegistroCassaOrderBy(IQueryable<RegistroCassa> query, string orderByClause)
    {
        var orderBy = orderByClause.Trim().ToLower();

        if (orderBy.Contains("data desc") || orderBy.Contains("date desc"))
        {
            return query.OrderByDescending(r => r.Data);
        }
        else if (orderBy.Contains("data asc") || orderBy == "data" || orderBy.Contains("date asc") || orderBy == "date")
        {
            return query.OrderBy(r => r.Data);
        }
        else if (orderBy.Contains("id desc") || orderBy.Contains("registerid desc"))
        {
            return query.OrderByDescending(r => r.Id);
        }
        else if (orderBy.Contains("id asc") || orderBy == "id" || orderBy.Contains("registerid asc") || orderBy == "registerid")
        {
            return query.OrderBy(r => r.Id);
        }
        else
        {
            return query.OrderByDescending(r => r.Data);
        }
    }
}
