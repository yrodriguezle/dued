using GraphQL.Types;

namespace duedgusto.GraphQL.Vendite.Types;

public class AggiornaVenditaInput
{
    public int? ProdottoId { get; set; }
    public decimal? Quantita { get; set; }
    public string? Note { get; set; }

    /// <summary>
    /// Cambia il metodo di pagamento. <c>null</c> = lascia quello che c'è.
    ///
    /// <para>È la correzione più probabile dopo un errore al bancone — «l'ho battuto
    /// elettronico ma ha pagato in contanti» — e sposta l'importo <b>da un secchio all'altro</b>,
    /// non solo dentro il suo.</para>
    /// </summary>
    public string? MetodoPagamento { get; set; }
}

public class AggiornaVenditaInputType : InputObjectGraphType<AggiornaVenditaInput>
{
    public AggiornaVenditaInputType()
    {
        Field(x => x.ProdottoId, nullable: true);
        Field(x => x.Quantita, nullable: true);
        Field(x => x.Note, nullable: true);
        Field(x => x.MetodoPagamento, nullable: true);
    }
}
