using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class MenuInputType : InputObjectGraphType<Menu>
{
    public MenuInputType()
    {
        Name = "MenuInput";
        Description = "Campi necessari per creare o aggiornare una voce di menu";

        Field<NonNullGraphType<IntGraphType>>(nameof(Menu.Id));
        Field<NonNullGraphType<StringGraphType>>(nameof(Menu.Titolo));
        Field<StringGraphType>(nameof(Menu.Percorso));
        Field<StringGraphType>(nameof(Menu.Icona));
        Field<NonNullGraphType<BooleanGraphType>>(nameof(Menu.Visibile));
        Field<NonNullGraphType<IntGraphType>>(nameof(Menu.Posizione));
        Field<StringGraphType>(nameof(Menu.PercorsoFile));
        Field<StringGraphType>(nameof(Menu.NomeVista));
        Field<IntGraphType>(nameof(Menu.MenuPadreId));
    }
}
