using System.Globalization;
using static DueD.Helpers.Globals;

namespace DueD.Helpers
{
    public static class UtilityHelper
    {
        public static object? NormalizeDateTime(object? pvalue)
        {
            if (pvalue is not null && pvalue.GetType() == typeof(DateTime) && (Convert.ToDateTime(pvalue).Year == 1899 || Convert.ToDateTime(pvalue).Year == 1900))
            {
                pvalue = null;
            }
            return pvalue;
        }

        private static string GetStringValueFromString(object value, bool noQuotes = false)
        {
            if (value == DBNull.Value || string.IsNullOrEmpty((string?)value))
            {
                return "''";
            }
            string? dbString = Convert.ToString(value ?? string.Empty);
            string? result = !noQuotes ? "'" + dbString?.Replace("'", "''") + "'" : dbString;
            return result ?? string.Empty;
        }
        private static string GetStringValueFromNumeric(object value)
        {
            Thread.CurrentThread.CurrentCulture = new CultureInfo("en-US");
            return (value == DBNull.Value) ? "null" : Convert.ToDecimal(value).ToString();
        }
        private static string GetStringValueFromDateOnly(object value)
        {
            return (Convert.ToString(value) == EMPTY_DATETIME || Convert.ToString(value) == EMPTY_DATETIME2) ? "null" : "{d '" + Convert.ToDateTime(value).ToString(DATE_FORMAT_DB) + "'}";
        }
        private static string GetStringValueFromTimeOnly(object value)
        {
            Thread.CurrentThread.CurrentCulture = new CultureInfo("en-US");
            return (Convert.ToString(value) == EMPTY_DATETIME || Convert.ToString(value) == EMPTY_DATETIME2) ? "null" : "{t '" + Convert.ToDateTime(value).ToString(TIME_FORMAT_DB) + "'}";
        }
        private static string GetStringValueFromDateTime(object value)
        {
            Thread.CurrentThread.CurrentCulture = new CultureInfo("en-US");
            return (Convert.ToString(value) == EMPTY_DATETIME || Convert.ToString(value) == EMPTY_DATETIME2) ? "null" : "{ts '" + Convert.ToDateTime(value).ToString(DATETIME_FORMAT_DB) + "'}";
        }
        private static string GetStringValueFromBoolean(object value)
        {
            return (Convert.ToBoolean(value) == true || Convert.ToInt32(value) != 0) ? "1" : "0";
        }
        private static string GetStringValueFromGuid(object value)
        {
            if (value == DBNull.Value)
            {
                return "''";
            }
            string? dbString = value.ToString();
            return string.IsNullOrEmpty(dbString) ? "''" : $"'{dbString.Replace("'", "''")}'";
        }

        public static string BuildDBString(object value, DBVarType varType, bool noQuotes = false)
        {
            return varType switch
            {
                DBVarType.String => GetStringValueFromString(value, noQuotes),
                DBVarType.Numeric => GetStringValueFromNumeric(value),
                DBVarType.DateOnly => GetStringValueFromDateOnly(value),
                DBVarType.TimeOnly => GetStringValueFromTimeOnly(value),
                DBVarType.DateTime => GetStringValueFromDateTime(value),
                DBVarType.Boolean => GetStringValueFromBoolean(value),
                DBVarType.Guid => GetStringValueFromGuid(value),
                _ => string.Empty,
            };
        }
    }
}
