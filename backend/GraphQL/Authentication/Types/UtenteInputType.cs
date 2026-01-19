using GraphQL.Types;

namespace duedgusto.GraphQL.Authentication;

public class UtenteInputType : InputObjectGraphType
{
    public UtenteInputType()
    {
        Name = "UtenteInput";
        Description = "Campi necessari per creare o aggiornare un utente";

        Field<IntGraphType>("id");
        Field<NonNullGraphType<StringGraphType>>("nomeUtente");
        Field<NonNullGraphType<StringGraphType>>("nome");
        Field<NonNullGraphType<StringGraphType>>("cognome");
        Field<StringGraphType>("descrizione");
        Field<BooleanGraphType>("disabilitato");
        Field<NonNullGraphType<IntGraphType>>("ruoloId");
        Field<StringGraphType>("password");
    }
}
