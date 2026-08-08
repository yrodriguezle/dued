using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

public class SpesaCassaType : ObjectGraphType<SpesaCassa>
{
    public SpesaCassaType()
    {
        Name = "SpesaCassa";
        Field(x => x.Id);
        Field(x => x.RegistroCassaId);
        Field(x => x.Descrizione);
        Field(x => x.Importo, type: typeof(DecimalGraphType));
        // Categoria della spesa NON tracciata (enum NOT NULL, default Altro).
        Field(x => x.Categoria, type: typeof(NonNullGraphType<CategoriaSpesaGraphType>));
        Field(x => x.Note, nullable: true);
    }
}

public class SpesaCassaInput
{
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    // Nullable in input: se assente, l'orchestrator applica il default CategoriaSpesa.Altro.
    public CategoriaSpesa? Categoria { get; set; }
}

public class SpesaCassaInputType : InputObjectGraphType<SpesaCassaInput>
{
    public SpesaCassaInputType()
    {
        Name = "SpesaCassaInput";
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        // Default Altro applicato lato orchestrator quando assente.
        Field(x => x.Categoria, type: typeof(CategoriaSpesaGraphType));
    }
}
