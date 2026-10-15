using GraphQL.Types;
using Microsoft.EntityFrameworkCore;
using duedgusto.Models;
using duedgusto.DataAccess;
using duedgusto.Services.GraphQL;

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
        // Nome della categoria, risolto via FK: il frontend consuma una stringa,
        // la stessa che mostra oggi (enum→nome verbatim). Resta NON nullo (NOT NULL sul DB).
        Field<NonNullGraphType<StringGraphType>>("categoria")
            .ResolveAsync(async context =>
            {
                AppDbContext db = GraphQLService.GetService<AppDbContext>(context);
                CategoriaSpesa? categoria = await db.CategorieSpesa
                    .FirstOrDefaultAsync(c => c.Id == context.Source.CategoriaId);
                return categoria?.Nome ?? "Altro";
            });
        Field(x => x.Note, nullable: true);
    }
}

public class SpesaCassaInput
{
    public string Descrizione { get; set; } = string.Empty;
    public decimal Importo { get; set; }
    // Nome della categoria (stringa, come consumato dal frontend). Se assente/null,
    // l'orchestrator applica il default "Altro".
    public string? Categoria { get; set; }
}

public class SpesaCassaInputType : InputObjectGraphType<SpesaCassaInput>
{
    public SpesaCassaInputType()
    {
        Name = "SpesaCassaInput";
        Field(x => x.Descrizione);
        Field(x => x.Importo);
        Field(x => x.Categoria, nullable: true);
    }
}
