using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class MenuType : ObjectGraphType<Menu>
{
    public MenuType()
    {
        Name = "Menu";
        Description = "Menu";
        Field(x => x.Id, typeof(IntGraphType));
        Field(x => x.Titolo, typeof(StringGraphType));
        Field(x => x.Percorso, typeof(StringGraphType));
        Field(x => x.Icona, typeof(StringGraphType));
        Field(x => x.Visibile, typeof(BooleanGraphType));
        Field(x => x.Posizione, typeof(IntGraphType));
        Field(x => x.PercorsoFile, typeof(StringGraphType));
        Field(x => x.NomeVista, typeof(StringGraphType));
        Field(x => x.MenuPadreId, typeof(IntGraphType));
    }
}
