using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Settings.Types;

public class PeriodoProgrammazioneType : ObjectGraphType<PeriodoProgrammazione>
{
    public PeriodoProgrammazioneType()
    {
        Field(x => x.PeriodoId);
        Field<StringGraphType>("dataInizio")
            .Resolve(ctx => ctx.Source.DataInizio.ToString("yyyy-MM-dd"));
        Field<StringGraphType>("dataFine")
            .Resolve(ctx => ctx.Source.DataFine?.ToString("yyyy-MM-dd"));
        Field(x => x.GiorniOperativi);
        Field<StringGraphType>("orarioApertura")
            .Resolve(ctx => ctx.Source.OrarioApertura.ToString("HH:mm"));
        Field<StringGraphType>("orarioChiusura")
            .Resolve(ctx => ctx.Source.OrarioChiusura.ToString("HH:mm"));
        Field(x => x.SettingsId);
        Field(x => x.CreatoIl);
        Field(x => x.AggiornatoIl);
    }
}
