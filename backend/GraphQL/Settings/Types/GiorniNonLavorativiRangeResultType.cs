using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Settings.Types;

/// <summary>
/// Esito della creazione massiva di giorni non lavorativi su un intervallo di date.
/// Le date già presenti vengono saltate e riportate in <see cref="DateSaltate"/>.
/// </summary>
public class GiorniNonLavorativiRangeResult
{
    public List<GiornoNonLavorativo> Creati { get; set; } = [];
    public List<string> DateSaltate { get; set; } = [];
    public int NumeroCreati => Creati.Count;
    public int NumeroSaltati => DateSaltate.Count;
}

public class GiorniNonLavorativiRangeResultType : ObjectGraphType<GiorniNonLavorativiRangeResult>
{
    public GiorniNonLavorativiRangeResultType()
    {
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<GiornoNonLavorativoType>>>>("creati")
            .Resolve(ctx => ctx.Source.Creati);
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<StringGraphType>>>>("dateSaltate")
            .Resolve(ctx => ctx.Source.DateSaltate);
        Field(x => x.NumeroCreati);
        Field(x => x.NumeroSaltati);
    }
}
