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
    }
}
