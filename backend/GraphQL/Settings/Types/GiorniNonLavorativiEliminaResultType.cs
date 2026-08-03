using GraphQL.Types;

namespace duedgusto.GraphQL.Settings.Types;

/// <summary>
/// Esito dell'eliminazione massiva di giorni non lavorativi.
/// Gli ID non più presenti a database finiscono in <see cref="IdsNonTrovati"/>
/// senza far fallire l'operazione.
/// </summary>
public class GiorniNonLavorativiEliminaResult
{
    public List<int> IdsEliminati { get; set; } = [];
    public List<int> IdsNonTrovati { get; set; } = [];
    public int NumeroEliminati => IdsEliminati.Count;
    public int NumeroNonTrovati => IdsNonTrovati.Count;
}

public class GiorniNonLavorativiEliminaResultType : ObjectGraphType<GiorniNonLavorativiEliminaResult>
{
    public GiorniNonLavorativiEliminaResultType()
    {
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("idsEliminati")
            .Resolve(ctx => ctx.Source.IdsEliminati);
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("idsNonTrovati")
            .Resolve(ctx => ctx.Source.IdsNonTrovati);
        Field(x => x.NumeroEliminati);
        Field(x => x.NumeroNonTrovati);
    }
}
