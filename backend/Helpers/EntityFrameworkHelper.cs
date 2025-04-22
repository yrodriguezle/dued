using System.Collections;
using System.Linq.Expressions;
using System.Reflection;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;

namespace duedgusto.Helpers;
public static class EntityFrameworkHelper
{
  public static object[] GetPrimaryKeyValues<TEntity>(this DbContext context, TEntity entity) where TEntity : class
  {
    EntityEntry<TEntity> entry = context.Entry(entity);
    IReadOnlyList<IProperty> keyProps = entry.Metadata.FindPrimaryKey()!.Properties;
    return [.. keyProps.Select(p => entry.Property(p.Name).CurrentValue!)];
  }

  public static string[] GetPrimaryKeyNames(this DbContext context, string tableName)
  {
    IEntityType? entityType = context.Model.GetEntityTypes().FirstOrDefault(e => string.Equals(e.GetTableName(), tableName, StringComparison.OrdinalIgnoreCase))
      ?? throw new InvalidOperationException($"No entity mapped to table '{tableName}' was found.");
    return [.. entityType.FindPrimaryKey()!.Properties.Select(p => p.Name)];
  }

  public static async Task<TEntity?> GetExistingEntityAsync<TEntity>(this DbContext context, TEntity entity) where TEntity : class
  {
    object[]? keyValues = context.GetPrimaryKeyValues(entity);
    if (keyValues.Length == 0) return null;
    return await context.FindAsync<TEntity>(keyValues);
  }

  public static bool ArePrimaryKeysEqual(object[] keys1, object[] keys2)
      => keys1.Length == keys2.Length && keys1.SequenceEqual(keys2);

  public static async Task<TEntity> UpsertEntityGraphAsync<TEntity>(
      this DbContext context,
      TEntity source,
      IEnumerable<string>? ignoreProperties = null,
      IEnumerable<string>? forceProperties = null)
      where TEntity : class
  {
    ignoreProperties ??= [];
    forceProperties ??= [];
    HashSet<object> visited = [];

    object[]? keyValues = context.GetPrimaryKeyValues(source);
    TEntity target = await context.FindAsync<TEntity>(keyValues) ?? context.Set<TEntity>().Add(source).Entity;

    MergeEntity(source, target, context,
        [.. ignoreProperties],
        [.. forceProperties],
        visited);

    return target;
  }

  private static void MergeEntity(
      object source,
      object target,
      DbContext context,
      HashSet<string> ignores,
      HashSet<string> forces,
      HashSet<object> visited)
  {
    if (source is null || target is null || visited.Contains(source))
      return;
    visited.Add(source);

    EntityEntry entry = context.Entry(target);
    Dictionary<string, object?> updates = [];

    foreach (PropertyInfo prop in source.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
    {
      if (!prop.CanRead || ignores.Contains(prop.Name))
        continue;

      object? value = prop.GetValue(source);
      bool isForced = forces.Contains(prop.Name);
      bool hasValue = value is not null || prop.PropertyType == typeof(DateTime?);
      if (!isForced && !hasValue)
        continue;

      // Skip PK props
      if (entry.Metadata.FindPrimaryKey()!.Properties.Any(k => k.Name == prop.Name))
      {
        updates[prop.Name] = value;
        continue;
      }

      // Reference navigation
      if (prop.PropertyType.IsClass && prop.PropertyType != typeof(string) && !typeof(IEnumerable).IsAssignableFrom(prop.PropertyType))
      {
        if (value != null)
        {
          object[] keyVals = context.GetPrimaryKeyValues(value);
          object? existing = context.Find(prop.PropertyType, keyVals);
          if (existing != null)
            MergeEntity(value, existing, context, ignores, forces, visited);
          else
            context.Add(value);
        }
        continue;
      }

      // Collection navigation
      if (typeof(IEnumerable).IsAssignableFrom(prop.PropertyType) && prop.PropertyType != typeof(string))
      {
        List<object> srcList = ((IEnumerable?)value)?.Cast<object>().ToList() ?? [];
        List<object> tgtList = ((IEnumerable?)prop.GetValue(target))?.Cast<object>().ToList() ?? [];

        // Build lookup on target by PK
        Dictionary<object[], object> lookup = tgtList.ToDictionary(
            x => context.GetPrimaryKeyValues(x),
            x => x,
            new ObjectArrayComparer());

        List<object> toAdd = [];
        List<(object src, object tgt)> toUpdate = [];
        foreach (object? srcItem in srcList)
        {
          object[] pk = context.GetPrimaryKeyValues(srcItem);
          if (lookup.TryGetValue(pk, out object? tgtItem))
          {
            toUpdate.Add((srcItem, tgtItem));
            lookup.Remove(pk);
          }
          else
          {
            toAdd.Add(srcItem);
          }
        }
        Dictionary<object[], object>.ValueCollection toDelete = lookup.Values;

        // Apply
        foreach (object item in toAdd) context.Add(item);
        foreach ((object srcItem, object tgtItem) in toUpdate) MergeEntity(srcItem, tgtItem, context, ignores, forces, visited);
        foreach (object? item in toDelete) context.Entry(item).State = EntityState.Deleted;

        continue;
      }
      updates[prop.Name] = value;
    }
    entry.CurrentValues.SetValues(updates);
  }

  public static async Task<TEntity> AddOrUpdateAsync<TEntity>(this DbContext context, TEntity entity, IEnumerable<string>? ignoreProperties = null, IEnumerable<string>? forceProperties = null)
    where TEntity : class
  {
    return await context.UpsertEntityGraphAsync(entity, ignoreProperties, forceProperties);
  }

  public static async Task<TEntity?> DeleteAsync<TEntity>(this DbContext context, TEntity entity) where TEntity : class
  {
    object[] keyValues = context.GetPrimaryKeyValues(entity);
    TEntity? existing = await context.FindAsync<TEntity>(keyValues);
    if (existing != null)
    {
      context.Remove(existing);
      await context.SaveChangesAsync();
    }
    return existing;
  }

  public static async Task<IEnumerable<TEntity>> GetEntitiesByKeysAsync<TEntity>(this DbContext context, IEnumerable<object[]> keyArrays) where TEntity : class
  {
    return await context.Set<TEntity>()
      .Where(e => keyArrays.Any(k => ArePrimaryKeysEqual(k, context.GetPrimaryKeyValues(e))))
      .ToListAsync();
  }

  public static ToAddOrUpdateOrDeleteResult<T> GetEntitiesToAddOrUpdateOrDelete<T>(
      this IEnumerable<T> incomingRows,
      IEnumerable<T> existingRows,
      DbContext context)
      where T : class
  {
    object[][] incomingIds = [.. incomingRows.Select(e => context.GetPrimaryKeyValues(e))];
    object[][] existingIds = [.. existingRows.Select(e => context.GetPrimaryKeyValues(e))];

    List<T> toDelete = [.. existingRows.Where(e => !incomingIds.Any(id => ArePrimaryKeysEqual(id, context.GetPrimaryKeyValues(e))))];
    List<T> toAdd = [.. incomingRows.Where(e => !existingIds.Any(id => ArePrimaryKeysEqual(id, context.GetPrimaryKeyValues(e))))];
    List<T> toUpdate = [.. incomingRows.Where(e => existingIds.Any(id => ArePrimaryKeysEqual(id, context.GetPrimaryKeyValues(e))))];

    return new ToAddOrUpdateOrDeleteResult<T>
    {
      ToAdd = toAdd,
      ToUpdate = toUpdate,
      ToDelete = toDelete
    };
  }

  public static bool UpdateBulk<TEntity>(this DbContext context, IEnumerable<TEntity> incomingRows, IEnumerable<TEntity> existingRows) where TEntity : class
  {
    ToAddOrUpdateOrDeleteResult<TEntity> result = incomingRows.GetEntitiesToAddOrUpdateOrDelete(existingRows, context);
    context.Set<TEntity>().RemoveRange(result.ToDelete);
    context.Set<TEntity>().AddRange(result.ToAdd);
    context.Set<TEntity>().UpdateRange(result.ToUpdate);
    return true;
  }

  public static async Task<bool> UpdateBulkAsync<T>(this DbContext context, IEnumerable<T> incomingRows, Func<IQueryable<T>, IQueryable<T>> filter) where T : class
  {
    List<T> dbRows = await filter(context.Set<T>()).AsNoTracking().ToListAsync();
    ToAddOrUpdateOrDeleteResult<T> result = incomingRows.GetEntitiesToAddOrUpdateOrDelete(dbRows, context);
    context.Set<T>().RemoveRange(result.ToDelete);
    context.Set<T>().AddRange(result.ToAdd);
    context.Set<T>().UpdateRange(result.ToUpdate);
    return true;
  }

  // public static async Task UpdateBulkNestedProperty<TEntity, TNested>(
  //     this DbContext context,
  //     TEntity entity,
  //     Expression<Func<TEntity, ICollection<TNested>>> navigation,
  //     List<TNested> incomingRows,
  //     Expression<Func<TNested, bool>> filter)
  //     where TEntity : class
  //     where TNested : class
  // {
  //     var dbRows = await context.Set<TNested>().Where(filter).AsNoTracking().ToListAsync();
  //     var changes = incomingRows.GetEntitiesToAddOrUpdateOrDelete(dbRows, context);
  //     var property = navigation.Compile().Invoke(entity);
  //     if (property != null)
  //     {
  //         context.Set<TNested>().RemoveRange(changes.ToDelete);
  //         property.Clear();
  //         property.AddRange(changes.ToAdd);
  //         context.Set<TNested>().UpdateRange(changes.ToUpdate);
  //     }
  // }

  public static async Task<bool> UpdateBulkWithIncludesAsync<TEntity>(
      this DbContext context,
      IEnumerable<TEntity> incomingRows,
      Expression<Func<TEntity, bool>> filter,
      IEnumerable<Expression<Func<TEntity, object>>> includes)
      where TEntity : class
  {
    var query = context.Set<TEntity>().Where(filter).AsNoTracking();
    foreach (var inc in includes) query = query.Include(inc);
    var dbRows = await query.ToListAsync();
    return context.UpdateBulk(incomingRows, dbRows);
  }

  public static T? GetOriginalValues<T>(EntityEntry<T> entry) where T : class, new()
  {
    if (entry.State == EntityState.Added) return null;
    T original = new();
    foreach (IProperty prop in entry.OriginalValues.Properties)
    {
      object? val = entry.OriginalValues[prop.Name];
      typeof(T).GetProperty(prop.Name)?.SetValue(original, val);
    }
    return original;
  }

  public static List<T> GetOriginalValues<T>(IEnumerable<EntityEntry<T>> entries) where T : class, new()
  {
    return [.. entries
          .Where(e => e.State != EntityState.Added)
          .Select(e => GetOriginalValues(e)!)];
  }
}

public class ObjectArrayComparer : IEqualityComparer<object[]>
{
  public bool Equals(object[]? x, object[]? y)
  {
    if (x == null || y == null) return false;
    return x.Length == y.Length && x.SequenceEqual(y);
  }

  public int GetHashCode(object[] obj)
  {
    unchecked
    {
      int hash = 17;
      foreach (object o in obj)
        hash = hash * 23 + (o?.GetHashCode() ?? 0);
      return hash;
    }
  }
}

public class ToAddOrUpdateOrDeleteResult<T>
{
  public List<T> ToAdd { get; set; } = [];
  public List<T> ToUpdate { get; set; } = [];
  public List<T> ToDelete { get; set; } = [];
}
