using duedgusto.Models;

namespace duedgusto.GraphQL.Fornitori;

public static class FatturaAcquistoStatusHelper
{
    /// <summary>
    /// Ricalcola lo stato della fattura in base ai pagamenti collegati.
    /// Centralizza la logica duplicata in mutatePagamento, eliminaPagamento e orchestrator.
    /// </summary>
    public static void RecalculateStato(FatturaAcquisto fattura)
    {
        var totalPaid = fattura.Pagamenti.Sum(p => p.Importo);
        var invoiceTotal = fattura.TotaleConIva ?? fattura.Imponibile;

        if (totalPaid >= invoiceTotal)
            fattura.Stato = "PAGATA";
        else if (totalPaid > 0)
            fattura.Stato = "PARZIALMENTE_PAGATA";
        else
            fattura.Stato = "DA_PAGARE";
    }
}
