namespace duedgusto;

public static class Globals
{
    public const string ROOT = "dued";
    public const string SERVER_FOLDER = "backend";
    public const int MAXIMUM_COMMAND_QUERY_OPERATION_TIMEOUT = 180; // Secondi

    public enum StateEnum
    {
        Create,
        Read,
        Update,
        Delete
    }
}
