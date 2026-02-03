namespace duedgusto.Models;

/// <summary>
/// Categorie di spese mensili libere (non legate a fatture fornitori)
/// </summary>
public enum CategoriaSpesa
{
    /// <summary>
    /// Affitto del locale commerciale
    /// </summary>
    Affitto,

    /// <summary>
    /// Utenze (elettricità, gas, acqua, internet, telefono)
    /// </summary>
    Utenze,

    /// <summary>
    /// Stipendi e compensi del personale
    /// </summary>
    Stipendi,

    /// <summary>
    /// Altre spese varie non categorizzate
    /// </summary>
    Altro
}
