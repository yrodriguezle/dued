namespace duedgusto.Models;

public class Ruolo
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descrizione { get; set; } = string.Empty;
    public ICollection<Utente> Utenti { get; set; } = [];
    public ICollection<Menu> Menus { get; set; } = [];
}
