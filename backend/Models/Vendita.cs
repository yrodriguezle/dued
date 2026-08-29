namespace duedgusto.Models;

public class Vendita
{
    public int VenditaId { get; set; }
    public int RegistroCassaId { get; set; } // Foreign key a RegistroCassa
    public int ProdottoId { get; set; } // Foreign key a Prodotto
    public decimal Quantita { get; set; } // Quantità venduta
    public decimal PrezzoUnitario { get; set; } // Prezzo unitario al momento della vendita
    public decimal PrezzoTotale { get; set; } // Totale (Quantita * PrezzoUnitario)
    public string? Note { get; set; } // Note sulla vendita
    public DateTime DataOra { get; set; } = DateTime.UtcNow; // Timestamp della vendita

    /// <summary>
    /// Come è stata pagata: uno dei tre valori di <see cref="Common.MetodiPagamentoVendita"/>.
    /// È ciò che decide in quale secchio del registro finisce l'importo — vedi
    /// <c>SecchiIncassiApplier</c>.
    ///
    /// <para>⚠️ Il default è <b>contante non tracciato</b>, e non è una scelta neutra a caso: è
    /// l'unico dei tre che non muove alcun campo del registro. Una vendita creata da un
    /// chiamante che non conosce ancora questo campo non può quindi gonfiare un incasso per
    /// sbaglio — il modo giusto di sbagliare.</para>
    /// </summary>
    public string MetodoPagamento { get; set; } = Common.MetodiPagamentoVendita.ContanteNonTracciato;

    /// <summary>
    /// Snapshot IVA al momento della vendita: aliquota in PERCENTUALE (es. 22.00),
    /// copiata dal prodotto alla creazione (immutabile salvo cambio prodotto).
    /// </summary>
    public decimal AliquotaIva { get; set; } = 22m;

    /// <summary>
    /// Imponibile scorporato da PrezzoTotale via IvaCalculator.ScorporaDaLordo.
    /// Invariante: Imponibile + ImportoIva == PrezzoTotale al centesimo.
    /// </summary>
    public decimal Imponibile { get; set; }

    /// <summary>IVA di riga (PrezzoTotale − Imponibile), parte dello snapshot.</summary>
    public decimal ImportoIva { get; set; }

    /// <summary>
    /// L'<see cref="Models.Ordine"/> alla cui chiusura questa vendita è nata.
    ///
    /// <para>⚠️ <b>Nullable solo per le righe di sviluppo nate prima degli ordini.</b> Con gli
    /// ordini una <c>Vendita</c> nasce esclusivamente nella chiusura di un ordine, quindi in
    /// produzione — dove la tabella <c>Vendite</c> è vuota — questo campo è di fatto obbligatorio
    /// dal primo giorno. La query di controllo post-deploy è
    /// <c>SELECT COUNT(*) FROM Vendite WHERE OrdineId IS NULL</c>: atteso 0.</para>
    ///
    /// <para>È il campo su cui poggia la guardia che impedisce di modificare o cancellare a mano
    /// una vendita nata da un ordine: quella si disfa <b>stornando l'ordine</b>, o il delta sui
    /// secchi resterebbe applicato senza più la riga che lo giustifica.</para>
    /// </summary>
    public int? OrdineId { get; set; }

    // Metadati
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public RegistroCassa RegistroCassa { get; set; } = null!;
    public Prodotto Prodotto { get; set; } = null!;
    public Ordine? Ordine { get; set; }
}
