using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Settings.Types;

public class GiornoNonLavorativoType : ObjectGraphType<GiornoNonLavorativo>
{
    public GiornoNonLavorativoType()
    {
        Field(x => x.GiornoId);
        Field<StringGraphType>("data")
            .Resolve(ctx => ctx.Source.Data.ToString("yyyy-MM-dd"));
        Field(x => x.Descrizione);
        Field(x => x.CodiceMotivo);
        Field(x => x.Ricorrente);
        Field(x => x.SettingsId);
        Field(x => x.CreatoIl);
        Field(x => x.AggiornatoIl);
    }
}
