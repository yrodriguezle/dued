namespace duedgusto.Models;

public class RegistroCassa
{
    public int Id { get; set; }
    public DateTime Data { get; set; }
    public int UtenteId { get; set; }

    // Totali contante
    public decimal TotaleApertura { get; set; }
    public decimal TotaleChiusura { get; set; }

    // Vendite e incassi (calcolati o inseriti)
    public decimal VenditeContanti { get; set; }
    public decimal IncassoContanteTracciato { get; set; }
    public decimal IncassiElettronici { get; set; }
    public decimal IncassiFattura { get; set; }
    public decimal TotaleVendite { get; set; }

    // Spese
    public decimal SpeseFornitori { get; set; }
    public decimal SpeseGiornaliere { get; set; }

    // Calcoli quadratura — replicano il foglio di chiusura (colonne Y, AD, AE, AG).
    // Fonte unica della formula: MutateRegistroCassaOrchestrator.CalcolaTotali.

    /// <summary>Colonna Y: contante fisico entrato in cassa (Chiusura − Apertura).</summary>
    public decimal ContanteNetto { get; set; }

    /// <summary>Colonna AD: contante dichiarato meno i pagamenti fornitori.</summary>
    public decimal RestoFornitore { get; set; }

    /// <summary>Colonna AE: contante entrato oltre a quello dichiarato (ContanteNetto − contanti).</summary>
    public decimal Ecc { get; set; }

    /// <summary>Colonna AG: Ecc al netto delle spese con scontrino.</summary>
    public decimal Resto { get; set; }

    // IVA
    public decimal ImportoIva { get; set; }

    // Metadati
    public string? Note { get; set; }
    public string Stato { get; set; } = "DRAFT"; // "DRAFT", "CLOSED", "RECONCILED"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Utente Utente { get; set; } = null!;
    public ICollection<ConteggioMoneta> ConteggiMoneta { get; set; } = [];
    public ICollection<SpesaCassa> SpeseCassa { get; set; } = [];
    public ICollection<PagamentoFornitore> PagamentiFornitori { get; set; } = [];
    public ICollection<RegistroCassaIva> BreakdownIva { get; set; } = [];
}
