namespace duedgusto.Models;

public class Menu
{
    public int Id { get; set; }
    public string Titolo { get; set; } = string.Empty;
    public string Percorso { get; set; } = string.Empty;
    public string Icona { get; set; } = string.Empty;
    public bool Visibile { get; set; } = true;
    public int Posizione { get; set; } = 0;
    public string PercorsoFile { get; set; } = string.Empty;
    public string NomeVista { get; set; } = string.Empty;
    public ICollection<Ruolo> Ruoli { get; set; } = [];

    // Relazione ricorsiva
    public int? MenuPadreId { get; set; }
    public Menu? MenuPadre { get; set; }
    public ICollection<Menu> Figli { get; set; } = [];
}
