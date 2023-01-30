namespace DueD.Helpers
{
    public static class Globals
    {
        public const int MAXIMUM_OPERATION_RETRY_TIME = 10;                     // Secondi
        public const int MAXIMUM_COMMAND_QUERY_OPERATION_TIMEOUT = 180;         // Secondi
        public const int MAXIMUM_LOCK_DURATION_TIME = 120;                      // Secondi
        public const int MAXIMUM_DOCUMENT_OPERATION_RETRY_TIME = 1;             // Secondi
        public const int MAXIMUM_DOCUMENT_LOCK_DURATION_TIME = 60;              // Secondi
        public const int LOCK_TOLLERANCE_TIME = 5;                              // Secondi
        public const int MAXIMUM_LIVE_LOGON_WITHOUT_UPDATE_TIME = 120;          // Secondi

        public const string DATETIME_FORMAT_DB = "yyyy-MM-dd HH:mm:ss";
        public const string DATE_FORMAT_DB = "yyyy-MM-dd";
        public const string TIME_FORMAT_DB = "HH:mm:ss";
        public const string EMPTY_DATETIME = "#12:00:00 AM#";
        public const string EMPTY_DATETIME2 = "01/01/0001 0:00:00";
        public const string EMPTY_DATETIME3 = "01/01/0001 0.00.00";
        public const string EMPTY_DATETIME_SQL_1 = "01/01/1900 00:00:00";
        public const string EMPTY_DATETIME_SQL_2 = "01/01/1900 0.00.00";
        public static readonly DateTime EMPTY_DATETIME_SQL = DateTime.Parse("01/01/1900");

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
    }
}
