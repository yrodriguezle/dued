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
        string? whereClause,
        string? orderByClause,
        Func<T, string> cursorSelector
    ) where T : class
    {
        // Recupera il DbContext e il DataLoader dal contesto
        AppDbContext dbContext = GetService<AppDbContext>(context);
        IDataLoaderContextAccessor dataLoaderAccessor = GetService<IDataLoaderContextAccessor>(context);
        DataLoaderContext dataLoader = dataLoaderAccessor.Context;

        // Recupera i parametri di paginazione:
        // "pageSize" indica il numero di elementi per pagina
        int pageSize = context.GetArgument<int?>("first") ?? 10;
        // "cursor" rappresenta l'offset numerico, con default 0 se non specificato
        int offset = context.GetArgument<int?>("cursor") ?? 0;

        // Recupera i metadati EF per il tipo T e il nome della tabella
        IEntityType entityType = dbContext.Model.FindEntityType(typeof(T))
            ?? throw new InvalidOperationException($"EntityType non trovato per {typeof(T).Name}");
        string tableName = entityType.GetTableName() ?? typeof(T).Name;

        // Recupera la chiave primaria, da usare come default per orderByClause se non specificata
        IProperty primaryKeyProperty = entityType.FindPrimaryKey()?.Properties.FirstOrDefault()
            ?? throw new InvalidOperationException("Chiave primaria non trovata.");
        string primaryKey = primaryKeyProperty.Name;

        // Se orderByClause non è specificato, usa per default la chiave primaria
        if (string.IsNullOrWhiteSpace(orderByClause))
        {
            orderByClause = primaryKey;
        }

        // Costruisce la clausola WHERE se presente
        string conditionSql = !string.IsNullOrWhiteSpace(whereClause) ? " WHERE " + whereClause : "";

        // Costruisci la query SQL con ORDER BY, LIMIT e OFFSET
        string sqlQuery = $"SELECT * FROM {tableName}{conditionSql} ORDER BY {orderByClause} LIMIT {pageSize} OFFSET {offset}";
        string sqlCountQuery = $"SELECT COUNT(*) FROM {tableName}{conditionSql}";

        // Definisce un loader key che tenga conto di offset, pageSize, where e orderBy per il caching
        string loaderKey = $"Get{tableName}_{offset}_{pageSize}_{whereClause}_{orderByClause}";
        IDataLoader<List<T>> loader = dataLoader.GetOrAddLoader(loaderKey, () =>
            dbContext.Set<T>().FromSqlRaw(sqlQuery).ToListAsync());
        List<T> items = await loader.LoadAsync().GetResultAsync();

        // Esegue la query per ottenere il totale delle righe
        int totalCount = 0;
        using (DbConnection connection = dbContext.Database.GetDbConnection())
        {
            if (connection.State == ConnectionState.Closed)
            {
                await connection.OpenAsync();
            }
            using DbCommand command = connection.CreateCommand();
            command.CommandText = sqlCountQuery;
            totalCount = Convert.ToInt32(await command.ExecuteScalarAsync());
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

// Modelli per la Connection Relay

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
