using GraphQL.Types;

using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.GestioneCassa.Types;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// Regressione sul passaggio enum→entità: la categoria di spesa, ora configurabile, viene
/// esposta al frontend come <b>nome stringa</b> (il valore che la tendina già consumava),
/// mentre la <see cref="CategoriaSpesaGraphType"/> (oggetto con id/nome/attiva/ordine) serve
/// soltanto alla query <c>categorieSpesa</c> di gestione. In nessun field di spesa/pagamento
/// può residuare una enum in CONSTANT_CASE: il frontend salva e legge "Affitto", non "AFFITTO".
/// </summary>
public class CategoriaSpesaGraphTypeTests
{
    private static FieldType FieldGraphType(IComplexGraphType graphType, string nome)
    {
        return graphType.Fields.Single(f => string.Equals(f.Name, nome, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Scarta i wrapper GraphQL (NonNull/List, riferimenti CLR e scalari concreti) per
    /// arrivare al CLR dello scalare (string/int/…).
    /// </summary>
    private static Type ScalareClr(FieldType field)
    {
        Type t = field.Type!;
        while (true)
        {
            if (t.IsGenericType && (t.GetGenericTypeDefinition() == typeof(NonNullGraphType<>)
                || t.GetGenericTypeDefinition() == typeof(ListGraphType<>)))
            {
                t = t.GetGenericArguments()[0];
                continue;
            }
            if (t.IsGenericType && (t.Name.StartsWith("GraphQLClrOutputTypeReference")
                || t.Name.StartsWith("GraphQLClrInputTypeReference")))
            {
                t = t.GetGenericArguments()[0];
                continue;
            }
            // Scalari concreti dichiarati esplicitamente (es. Field<StringGraphType>).
            if (t == typeof(StringGraphType)) return typeof(string);
            if (t == typeof(IntGraphType)) return typeof(int);
            return t;
        }
    }

    /// <summary>Il tipo categoria espone id (int) e nome (string): è un oggetto, non una enum.</summary>
    [Fact]
    public void Categoria_EEspostaComeOggettoConIdENome()
    {
        var type = new CategoriaSpesaGraphType();

        type.Name.Should().Be("CategoriaSpesa");
        ScalareClr(FieldGraphType(type, "nome")).Should().Be<string>();
        ScalareClr(FieldGraphType(type, "id")).Should().Be<int>();
    }

    /// <summary>I field `categoria` di spesa/pagamento restano una STRINGA, non una enum né un oggetto.</summary>
    [Fact]
    public void FieldCategoria_DiSpesaEPagamento_SonoStringhe()
    {
        ScalareClr(FieldGraphType(new SpesaCassaType(), "categoria")).Should().Be<string>();
        ScalareClr(FieldGraphType(new PagamentoFornitoreType(), "categoria")).Should().Be<string>();
    }

    /// <summary>Gli input portano la categoria come stringa opzionale (default Altro lato server).</summary>
    [Fact]
    public void FieldCategoria_InputSonoStringheNullable()
    {
        ScalareClr(FieldGraphType(new SpesaCassaMutateInputType(), "categoria")).Should().Be<string>();
        ScalareClr(FieldGraphType(new PagamentoFornitoreInputType(), "categoria")).Should().Be<string>();
    }
}
