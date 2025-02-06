using System.Data.Common;
using System.Globalization;

namespace duedgusto.Helpers;

public enum DBVarType
{
    String = 0,
    Numeric = 1,
    DateOnly = 2,
    TimeOnly = 3,
    DateTime = 4,
    Boolean = 5,
    Guid = 6
}
public class UtilityHelper
{
    public const string DATE_FORMAT_DB = "yyyy-MM-dd";
    public const string DATETIME_FORMAT_DB = "yyyy-MM-dd HH:mm:ss";
    public const string TIME_FORMAT_DB = "HH:mm:ss";

    public static object? N2D(object? pvalue)
    {
        if (pvalue != null && pvalue.GetType() == typeof(DateTime) && (Convert.ToDateTime(pvalue).Year == 1899 || Convert.ToDateTime(pvalue).Year == 1900))
        {
            pvalue = null;
        }
        return pvalue;
    }
    public static decimal N2Z(object value, decimal? defaultValue = null)
    {
        // Restituisce zero se il valore è null
        decimal result = 0;
        if (defaultValue != null) { result = (decimal)defaultValue; };
        if (value == null || value == DBNull.Value) return result;
        else if (decimal.TryParse(value.ToString(), out decimal numericValue)) return numericValue; else return result;
    }

    public static string GetPathRoot()
    {
        string currentDirectory = Directory.GetCurrentDirectory();
        return Path.GetPathRoot(currentDirectory) ?? string.Empty;
    }

    public static string GetAppRootFolder()
    {
        return Path.Combine(GetPathRoot(), Globals.ROOT);
    }

    public static string GetServerFolder()
    {
        return Path.Combine(GetPathRoot(), Globals.ROOT, Globals.SERVER_FOLDER);
    }

    public static void SetTransactionIsolationLevel(DbCommand command)
    {
        command.CommandText = $"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED{Environment.NewLine}{command.CommandText}";
    }

    private static string StringToDB(object value, bool noQuotes = false)
    {
        if (value == DBNull.Value || value == null)
        {
            return "''";
        }
        string? temp = Convert.ToString(value);
        if (string.IsNullOrEmpty(temp))
        {
            return "''";
        }
        if (!noQuotes)
        {
            return $"'{temp.Replace("'", "''")}'";
        }
        return string.IsNullOrEmpty(temp) ? string.Empty : temp;
    }
    private static string NumericToDB(object value)
    {
        Thread.CurrentThread.CurrentCulture = new CultureInfo("en-US");
        if (value == DBNull.Value || value == null)
        {
            return "NULL";
        }
        Thread.CurrentThread.CurrentCulture = new CultureInfo("it-IT");
        return Convert.ToDecimal(value).ToString();
    }
    private static string DateTimeToDB(object value, string format = DATETIME_FORMAT_DB)
    {
        if (value == null)
        {
            throw new ArgumentNullException(nameof(value), "Value cannot be null.");
        }

        if (value is DateTime dateTime)
        {
            string formattedValue = dateTime.ToString(format, CultureInfo.InvariantCulture);

            string sqlType = format switch
            {
                DATE_FORMAT_DB => "DATE",
                DATETIME_FORMAT_DB => "DATETIME",
                TIME_FORMAT_DB => "TIME",
                _ => throw new ArgumentException("Invalid format specified.", nameof(format))
            };
            return $"CONVERT({sqlType}, '{formattedValue}', 126)";
        }
        throw new ArgumentException("Value must be of type DateTime.", nameof(value));
    }
    private static string BooleanToDB(object value)
    {
        if (value == DBNull.Value || value == null)
        {
            return "0";
        }
        return Convert.ToBoolean(value) ? "1" : "0";
    }
    private static string GuidToDB(object value)
    {
        if (value == DBNull.Value || value == null)
        {
            return "''";
        }
        return StringToDB(value, true);
    }

    public static string BuildDBString(object value, DBVarType varType, bool noQuotes = false)
    {
        return varType switch
        {
            DBVarType.String => StringToDB(value, noQuotes),
            DBVarType.Numeric => NumericToDB(value),
            DBVarType.DateOnly => DateTimeToDB(value, DATE_FORMAT_DB),
            DBVarType.TimeOnly => DateTimeToDB(value, TIME_FORMAT_DB),
            DBVarType.DateTime => DateTimeToDB(value, DATETIME_FORMAT_DB),
            DBVarType.Boolean => BooleanToDB(value),
            DBVarType.Guid => GuidToDB(value),
            _ => throw new ArgumentException($"Invalid varType: {varType}", nameof(varType))
        };
    }
}
