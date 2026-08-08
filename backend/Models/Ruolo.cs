namespace duedgusto.Models;

public class Ruolo
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Descrizione { get; set; } = string.Empty;

    /// <summary>
    /// Indica che il ruolo ha privilegi amministrativi: abilita le operazioni
    /// sensibili come la riapertura di un registro cassa già chiuso.
    /// Gestito dall'anagrafica ruoli, non dal nome del ruolo.
    /// </summary>
    public bool Amministratore { get; set; }

    public ICollection<Utente> Utenti { get; set; } = [];
    public ICollection<Menu> Menus { get; set; } = [];
}
