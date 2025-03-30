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
    public required byte[] Hash { get; set; }
    public required byte[] Salt { get; set; }
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
}
