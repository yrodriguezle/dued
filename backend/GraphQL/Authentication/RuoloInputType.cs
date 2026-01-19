using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.Authentication;

public class RuoloInputType : InputObjectGraphType<Ruolo>
{
    public RuoloInputType()
    {
        Name = "RuoloInput";
        Description = "Campi necessari per creare o aggiornare un ruolo";

        Field<NonNullGraphType<IntGraphType>>(nameof(Ruolo.Id));
        Field<NonNullGraphType<StringGraphType>>(nameof(Ruolo.Nome));
        Field<StringGraphType>(nameof(Ruolo.Descrizione));
    }
}
