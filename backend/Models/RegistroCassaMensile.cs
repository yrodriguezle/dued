using System.ComponentModel.DataAnnotations.Schema;

namespace duedgusto.Models;

/// <summary>
/// Join table che associa i registri cassa giornalieri a una chiusura mensile.
/// Traccia esplicitamente quali registri appartengono a quale chiusura.
/// </summary>
[Table("RegistriCassaMensili")]
public class RegistroCassaMensile
{
    /// <summary>
    /// ID della chiusura mensile
    /// </summary>
    public int ChiusuraId { get; set; }

    /// <summary>
    /// ID del registro cassa giornaliero
    /// </summary>
    public int RegistroId { get; set; }

    /// <summary>
    /// Flag che indica se il registro è incluso nel calcolo dei totali.
    /// Permette esclusioni temporanee senza eliminare il link.
    /// </summary>
    public bool Incluso { get; set; } = true;

    // Navigation properties
    [ForeignKey("ChiusuraId")]
    public ChiusuraMensile Chiusura { get; set; } = null!;

    [ForeignKey("RegistroId")]
    public RegistroCassa Registro { get; set; } = null!;
}
