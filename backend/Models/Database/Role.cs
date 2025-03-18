using System.ComponentModel.DataAnnotations;

namespace duedgusto.Models;

public class Role
{
    [Key]
    public int Id { get; set; }
    public required string Name { get; set; }

    public ICollection<User>? Users { get; set; }
}
