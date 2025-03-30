namespace duedgusto.Models;

public class Role
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string RoleDescription { get; set; } = string.Empty;
    public ICollection<User> Users { get; set; } = [];
    public ICollection<Menu> Menus { get; set; } = [];
}
