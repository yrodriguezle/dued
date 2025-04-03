using System.Data;
using System.Data.Common;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

using GraphQL;
using GraphQL.DataLoader;

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
        string whereClause,
        Func<T, string> cursorSelector
    ) where T : class
    {
        // Recupera il DbContext e il DataLoader dal contesto
        AppDbContext dbContext = GetService<AppDbContext>(context);
        IDataLoaderContextAccessor dataLoaderAccessor = GetService<IDataLoaderContextAccessor>(context);
        DataLoaderContext dataLoader = dataLoaderAccessor.Context;

        // Recupera i parametri di paginazione tramite GetArgument
        int first = context.GetArgument<int?>("first") ?? 10;
        string? after = context.GetArgument<string>("after");

        // Recupera i metadati EF per il tipo T
        IEntityType entityType = dbContext.Model.FindEntityType(typeof(T)) ?? throw new InvalidOperationException($"EntityType non trovato per {typeof(T).Name}");

        // Recupera il nome della tabella (GetTableName è disponibile in EF Core 3+)
        string tableName = entityType.GetTableName() ?? typeof(T).Name;

        // Recupera il nome della chiave primaria (prendiamo il primo se ci sono più chiavi)
        IProperty primaryKeyProperty = (entityType.FindPrimaryKey()?.Properties.FirstOrDefault()) ?? throw new InvalidOperationException("Chiave primaria non trovata.");
        string primaryKey = primaryKeyProperty.Name;

        // Costruisci la lista delle condizioni
        List<string> conditions = [];
        if (!string.IsNullOrWhiteSpace(whereClause))
        {
            conditions.Add(whereClause);
        }
        if (!string.IsNullOrEmpty(after) && int.TryParse(after, out int afterValue))
        {
            conditions.Add($"{primaryKey} > {afterValue}");
        }

        string conditionSql = conditions.Count != 0 ? " WHERE " + string.Join(" AND ", conditions) : "";

        // Costruisci la query SQL per gli elementi e per il conteggio
        string sqlQuery = $"SELECT * FROM {tableName}{conditionSql} ORDER BY {primaryKey} LIMIT {first}";
        string sqlCountQuery = $"SELECT COUNT(*) FROM {tableName}{conditionSql}";

        // Nome del DataLoader: "Get" + NomeTabella
        string loaderKey = $"Get{tableName}";

        // Usa il DataLoader per caricare gli elementi in batch
        IDataLoader<List<T>> loader = dataLoader.GetOrAddLoader(loaderKey, () => dbContext.Set<T>().FromSqlRaw(sqlQuery).ToListAsync());
        List<T> items = await loader.LoadAsync().GetResultAsync();

        // Esegui la query per ottenere il totale delle righe
        int totalCount = 0;
        using (DbConnection connection = dbContext.Database.GetDbConnection())
        {
            if (connection.State == ConnectionState.Closed)
            {
                await connection.OpenAsync();
            }

            using (DbCommand command = connection.CreateCommand())
            {
                command.CommandText = sqlCountQuery;
                totalCount = Convert.ToInt32(await command.ExecuteScalarAsync());
            }
        }

        // Converte la lista di elementi in una Connection Relay
        Connection<T> connectionResult = ToConnection(items, context, cursorSelector);
        connectionResult.TotalCount = totalCount;
        return connectionResult;
    }

    /// <summary>
    /// Converte una collezione di elementi in una Connection Relay.
    /// </summary>
    public static Connection<T> ToConnection<T>(
        IEnumerable<T> items,
        IResolveFieldContext<object?> context,
        Func<T, string> cursorSelector
    )
    {
        var list = items.ToList();
        var edges = list.Select(item => new Edge<T>
        {
            Node = item,
            Cursor = cursorSelector(item)
        }).ToList();

        string? startCursor = edges.FirstOrDefault()?.Cursor;
        string? endCursor = edges.LastOrDefault()?.Cursor;

        // In questo esempio, HasNextPage e HasPreviousPage sono impostati a false.
        var pageInfo = new PageInfo
        {
            StartCursor = startCursor,
            EndCursor = endCursor,
            HasNextPage = false,
            HasPreviousPage = false
        };

        return new Connection<T>
        {
            Edges = edges,
            PageInfo = pageInfo,
            TotalCount = list.Count
        };
    }
}

// Definizione dei modelli per la Connection Relay
public class Connection<T>
{
    public IEnumerable<Edge<T>> Edges { get; set; } = Enumerable.Empty<Edge<T>>();
    public PageInfo PageInfo { get; set; } = new PageInfo();
    public int TotalCount { get; set; }
}

public class Edge<T>
{
    public string Cursor { get; set; } = string.Empty;
    public T Node { get; set; } = default!;
}

public class PageInfo
{
    public string? StartCursor { get; set; }
    public string? EndCursor { get; set; }
    public bool HasNextPage { get; set; }
    public bool HasPreviousPage { get; set; }
}
