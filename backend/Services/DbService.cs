using DueD.Helpers;
using MySqlConnector;
using System.Data;
using System.Reflection;

namespace DueD.Services
{
    public class DbService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<DbService> _logger;

        public DbService(IConfiguration configuration, ILogger<DbService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<T> ExecuteSqlQuery<T>(string connectionString, string querySql, Func<MySqlDataReader, T> callback)
        {
            using MySqlConnection dbConnection = new MySqlConnection(connectionString);
            try
            {
                await dbConnection.OpenAsync().ConfigureAwait(false);
                using MySqlCommand command = dbConnection.CreateCommand();
                {
                    command.CommandText = querySql;
                    command.CommandTimeout = Globals.MAXIMUM_COMMAND_QUERY_OPERATION_TIMEOUT;
                    using MySqlDataReader reader = await command.ExecuteReaderAsync().ConfigureAwait(false);
                    {
                        if (!(bool)(reader?.HasRows))
                        {
                            return default;
                        }
                        return callback(reader);
                    }
                }
            }
            catch (Exception exception)
            {
                _logger.LogError(exception.Message);
                return default;
            }
            finally
            {
                if (dbConnection.State == ConnectionState.Open)
                {
                    dbConnection.Close();
                }
            }
        }

        private async Task<bool> ExecuteSqlMutation(string connectionString, Func<MySqlCommand, bool> callback, bool shouldManageException = true)
        {
            using MySqlConnection dbConnection = new MySqlConnection(connectionString);
            {
                try
                {
                    await dbConnection.OpenAsync().ConfigureAwait(false);
                    using MySqlCommand command = dbConnection.CreateCommand();
                    return callback(command);
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception.Message);
                    if (shouldManageException)
                    {
                        return false;
                    }
                    throw;
                }
                finally
                {
                    if (dbConnection.State == ConnectionState.Open)
                    {
                        dbConnection.Close();
                    }
                }
            }
        }

        public string GetApplicationName()
        {
            AssemblyProductAttribute productAttribute = (AssemblyProductAttribute)Attribute.GetCustomAttribute(Assembly.GetExecutingAssembly(), typeof(AssemblyProductAttribute));
            return productAttribute.Product;
        }

        public string GetApplicationVersion()
        {
            return Assembly.GetEntryAssembly().GetCustomAttribute<AssemblyFileVersionAttribute>().Version.Replace(".0", "");
        }

        public async Task<bool> AreUniqueFieldsInTable(string tableName, string fieldsString, bool goToDataRepository)
        {
            try
            {
                string querySql = $"SELECT COUNT(*) as TotalRows  FROM [{tableName}] GROUP BY {fieldsString} HAVING COUNT(*) > 1;";
                string connectionString = _configuration.GetConnectionString("Default");
                int totalRows = await ExecuteSqlQuery(connectionString, querySql, (MySqlDataReader reader) => {
                    while (reader.Read())
                    {
                        return reader.IsDBNull(reader.GetOrdinal("TotalRows"))
                            ? 0
                            : reader.GetFieldValue<int>(reader.GetOrdinal("TotalRows"));
                    }
                    return 0;
                });
                return totalRows == 0;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception.Message);
                return false;
            }
        }

        public async Task<int> GetQueryRecordsCount(string sqlQuery, string whereClause = "")
        {
            try
            {
                string connectionString = _configuration.GetConnectionString("Default");
                string whereStatement = !string.IsNullOrEmpty(whereClause)
                    ? $" WHERE {whereClause} "
                    : string.Empty;
                string querySql = @$"SELECT COUNT(*) AS TotalRows FROM {sqlQuery}
					{whereStatement}
				";
                return await ExecuteSqlQuery(connectionString, querySql, (MySqlDataReader reader) => {
                    while (reader.Read())
                    {
                        return reader.IsDBNull(reader.GetOrdinal("TotalRows"))
                            ? 0
                            : reader.GetFieldValue<int>(reader.GetOrdinal("TotalRows"));
                    }
                    return 0;
                });
            }
            catch (Exception)
            {
                return 0;
            }
        }
    }
}
