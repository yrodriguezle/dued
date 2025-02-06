using System.ComponentModel.DataAnnotations;

namespace duedgusto.Models;

public class User
{
    [Key]
    public int Id { get; set; }
    public required string Username { get; set; }
    public required string PasswordHash { get; set; }
    public required string RefreshToken { get; set; }

    // Relazione con Role
    public int RoleId { get; set; }
    public required Role Role { get; set; }
}
