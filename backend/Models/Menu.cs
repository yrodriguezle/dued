namespace duedgusto.Models;

public class Menu
{
    public int MenuId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public bool IsVisible { get; set; } = true;
    public ICollection<Role> Roles { get; set; } = [];

    // Relazione ricorsiva
    public int? ParentMenuId { get; set; }
    public Menu? ParentMenu { get; set; }
    public ICollection<Menu> Children { get; set; } = [];
}
