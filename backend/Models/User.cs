namespace duedgusto.Models;

public class User
{
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Description { get; set; }
    public bool? Disabled { get; set; }
    public string? RefreshToken { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
}
