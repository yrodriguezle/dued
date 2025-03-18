using System.Reflection;

using GraphQL;

using duedgusto.DataAccess;

namespace duedgusto.Services;

public static class GraphQLService
{
    private static async Task<T> GetEntityFromContextAsync<T>(IResolveFieldContext<object?> context)
    {
        if (context.Source == null)
        {
            throw new InvalidOperationException("context.Source are not available.");
        }
        return await Task.FromResult((T)context.Source);
    }
    public static async Task<T?> GetByIds<T, TRepository>(IResolveFieldContext<object?> context, object[] keys)
        where T : class
        where TRepository : IRepositoryBase<T>
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("Request services are not available.");
        }
        using var scope = context.RequestServices.CreateScope();
        IServiceProvider services = scope.ServiceProvider;
        TRepository repository = services.GetRequiredService<TRepository>() ?? throw new InvalidOperationException($"Unable to resolve service for type '{typeof(TRepository)}'.");
        return await repository.GetByIds(keys);
    }

    public static async Task<T> AddOrUpdateEntity<T, TRepository>(IResolveFieldContext<object?> context, string? idKey = null)
    where T : class
    where TRepository : IRepositoryBase<T>
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("Request services are not available.");
        }
        using IServiceScope scope = context.RequestServices.CreateScope();
        IServiceProvider services = scope.ServiceProvider;
        TRepository repository = services.GetRequiredService<TRepository>() ?? throw new InvalidOperationException($"Unable to resolve service for type '{typeof(TRepository)}'.");
        T value = context.GetArgument<T>("value");

        // Ottieni i campi effettivamente passati
        var inputList = context.GetArgument<List<KeyValuePair<string, object>>>("value");
        var inputFields = inputList.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);

        T? existingEntity = null;

        // Se è stato passato un idKey allora verifica se è da assegnare in modo automatico
        if (idKey != null)
        {
            PropertyInfo? propertyInfo = typeof(T).GetProperty(idKey);
            if (propertyInfo != null)
            {
                object? keyValue = propertyInfo.GetValue(value);
                if (keyValue != null && int.TryParse(keyValue.ToString(), out int idValue))
                {
                    if (idValue != 0)
                    {
                        // Carica l'entità esistente
                        existingEntity = await repository.GetByIds([keyValue]);
                        if (existingEntity == null)
                        {
                            throw new InvalidOperationException($"Entity with ID '{idValue}' not found.");
                        }
                    }
                }
            }
        }

        if (existingEntity != null)
        {
            // Aggiorna solo le proprietà fornite nell'input
            foreach (PropertyInfo prop in typeof(T).GetProperties())
            {
                if (inputFields.ContainsKey(prop.Name) && prop.CanWrite)
                {
                    var newValue = inputFields[prop.Name];
                    prop.SetValue(existingEntity, newValue);
                }
            }
            value = existingEntity;
        }

        return await repository.Save(value);
    }
    public static async Task<List<string>> IsDeletableEntity<T, TRepository>(IResolveFieldContext<object?> context)
        where T : class
        where TRepository : IRepositoryBase<T>
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("Request services are not available.");
        }
        using IServiceScope scope = context.RequestServices.CreateScope();
        IServiceProvider services = scope.ServiceProvider;
        TRepository repository = services.GetRequiredService<TRepository>() ?? throw new InvalidOperationException($"Unable to resolve service for type '{typeof(TRepository)}'.");
        T value = context.Source is T source ? source : context.GetArgument<T>("value");
        return await repository.IsDeletable(value);
    }
    public static async Task<T?> DeleteEntity<T, TRepository>(IResolveFieldContext<object?> context)
        where T : class
        where TRepository : IRepositoryBase<T>
    {
        if (context.RequestServices == null)
        {
            throw new InvalidOperationException("Request services are not available.");
        }
        using var scope = context.RequestServices.CreateScope();
        IServiceProvider services = scope.ServiceProvider;
        TRepository repository = services.GetRequiredService<TRepository>() ?? throw new InvalidOperationException($"Unable to resolve service for type '{typeof(TRepository)}'.");
        T value = context.GetArgument<T>("value");

        return await repository.Delete(value);
    }
}
