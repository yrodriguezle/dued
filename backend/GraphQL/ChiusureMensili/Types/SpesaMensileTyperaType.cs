using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.ChiusureMensili.Types;

/// <summary>
/// GraphQL Type per SpesaMensileLibera (spese non legate a fatture)
/// </summary>
public class SpesaMensileTyperaType : ObjectGraphType<SpesaMensileLibera>
{
    public SpesaMensileTyperaType()
    {
        Name = "SpesaMensileLibera";
        Description = "Spesa mensile libera (affitto, utenze, stipendi, altro)";

        Field(x => x.SpesaId);
        Field(x => x.ChiusuraId);
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field<StringGraphType>("categoria")
            .Resolve(context => context.Source.Categoria.ToString());
        Field(x => x.CreatoIl, type: typeof(DateTimeGraphType));
        Field(x => x.AggiornatoIl, type: typeof(DateTimeGraphType));

        // Navigation property
        Field<ChiusuraMensileType, ChiusuraMensile>("chiusura")
            .Resolve(context => context.Source.Chiusura);
    }
}
