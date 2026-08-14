using System.Data;
using System.Data.Common;
using System.Linq.Expressions;
using System.Text.RegularExpressions;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL;
using GraphQL.Types.Relay.DataObjects;

using duedgusto.DataAccess;
using duedgusto.Models;
using System.Reflection;

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

    public static Task<Connection<T>> GetConnectionAsync<T>(
        IResolveFieldContext<object?> context,
        string? whereClause,
        string? orderByClause
    ) where T : class =>
        GetConnectionAsync<T>(context, whereClause, orderByClause, query => query);

    // Overload that accepts a query configurator for complex queries with includes
    public static async Task<Connection<T>> GetConnectionAsync<T>(
        IResolveFieldContext<object?> context,
        string? whereClause,
        string? orderByClause,
        Func<IQueryable<T>, IQueryable<T>> queryConfigurator
    ) where T : class
    {
        AppDbContext dbContext = GetService<AppDbContext>(context);

        int pageSize = context.GetArgument<int?>("first") ?? 10;
        int offset = LeggiOffset(context);

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

        // 🔴 Il cursore è la POSIZIONE dell'elemento nella sequenza ordinata, non la sua chiave
        //    primaria — cioè esattamente ciò che `Skip` qui sopra si aspetta di ricevere indietro.
        //    Emettere la chiave era il guasto che faceva sparire righe intere dalle griglie: il
        //    client rimandava `endCursor` come `cursor`, lo `Skip` saltava a un id arbitrario e le
        //    righe in mezzo non venivano richieste mai, senza alcun errore. Il contratto è uno
        //    solo: **ciò che esce da endCursor deve poter rientrare da cursor/after**.
        //
        // ⚠️ Vale anche per il cursore del singolo edge, non solo per pageInfo: un client Relay
        //    pagina con `after: edges.last.cursor`, e due semantiche diverse nella stessa risposta
        //    romperebbero quel client lasciando sano il nostro.
        List<Edge<T>> edges = [.. items.Select((item, indice) => new Edge<T>
        {
            Node = item,
            Cursor = (offset + indice + 1).ToString()
        })];

        PageInfo pageInfo = new()
        {
            StartCursor = edges.FirstOrDefault()?.Cursor,
            EndCursor = edges.LastOrDefault()?.Cursor,
            HasNextPage = (offset + items.Count) < totalCount,
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
    /// Quante righe saltare, letta dai due argomenti che il progetto espone: <c>after</c> (stringa,
    /// forma Relay) e <c>cursor</c> (intero, forma storica). Sono deliberatamente <b>la stessa
    /// cosa</b> — un offset — perché le due metà del frontend usano l'uno o l'altro
    /// (<c>useFetchData</c> il primo, <c>useGetAll</c> il secondo) e una divergenza fra i due
    /// romperebbe metà delle liste lasciando l'altra sana, che è il modo peggiore di sbagliare.
    /// </summary>
    private static int LeggiOffset(IResolveFieldContext<object?> context)
    {
        string? afterCursor = context.GetArgument<string?>("after");
        if (!string.IsNullOrEmpty(afterCursor) && int.TryParse(afterCursor, out int parsedAfter))
        {
            return parsedAfter;
        }
        return context.GetArgument<int?>("cursor") ?? 0;
    }

    /// <summary>
    /// Generic LIKE WHERE clause parser. Converts frontend LIKE patterns into safe LINQ expressions.
    /// Supports: "table.field LIKE "%value%"", multiple conditions joined by AND, e più LIKE
    /// in OR all'interno di una singola condizione (es. ricerca su più campi):
    /// "(table.f1 LIKE "%v%" OR table.f2 LIKE "%v%")".
    /// Safe from SQL injection: uses Expression trees that EF Core translates to parameterized SQL.
    /// </summary>
    private static IQueryable<T> ApplyLikeWhereClause<T>(IQueryable<T> query, string whereClause) where T : class
    {
        var conditions = whereClause.Split(new[] { " AND ", " and " }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var condition in conditions)
        {
            var trimmed = condition.Trim().Trim('(', ')').Trim();

            // Una condizione può contenere più LIKE in OR (ricerca multi-campo).
            var orParts = trimmed.Split(new[] { " OR ", " or " }, StringSplitOptions.RemoveEmptyEntries);

            ParameterExpression parameter = Expression.Parameter(typeof(T), "e");
            Expression? orExpression = null;

            foreach (var orPart in orParts)
            {
                // Match pattern: "tableName.fieldName LIKE "%value%""
                Match likeMatch = Regex.Match(orPart.Trim(), @"(\w+)\.(\w+)\s+LIKE\s+""%(.+?)%""", RegexOptions.IgnoreCase);

                if (!likeMatch.Success) continue;

                var fieldName = likeMatch.Groups[2].Value;
                var searchValue = likeMatch.Groups[3].Value;

                // Find property on entity (case-insensitive match)
                PropertyInfo? property = typeof(T).GetProperties()
                          .FirstOrDefault(p => string.Equals(p.Name, fieldName, StringComparison.OrdinalIgnoreCase));

                if (property == null || property.PropertyType != typeof(string)) continue;

                // Build: entity => entity.Property != null && entity.Property.Contains(searchValue)
                MemberExpression propertyAccess = Expression.Property(parameter, property);
                BinaryExpression nullCheck = Expression.NotEqual(propertyAccess, Expression.Constant(null, typeof(string)));
                ConstantExpression searchConstant = Expression.Constant(searchValue, typeof(string));
                MethodInfo containsMethod = typeof(string).GetMethod("Contains", new[] { typeof(string) })!;
                MethodCallExpression containsCall = Expression.Call(propertyAccess, containsMethod, searchConstant);
                BinaryExpression combined = Expression.AndAlso(nullCheck, containsCall);

                orExpression = orExpression == null ? combined : Expression.OrElse(orExpression, combined);
            }

            if (orExpression == null) continue;

            var lambda = Expression.Lambda<Func<T, bool>>(orExpression, parameter);
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
