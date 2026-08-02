using GraphQL.Types;

using duedgusto.GraphQL.Fornitori.Types;
using duedgusto.GraphQL.GestioneCassa.Types;

namespace DuedGusto.Tests.Unit.GraphQL;

/// <summary>
/// Regressione: la enum <c>CategoriaSpesa</c> DEVE essere esposta in GraphQL con i nomi .NET
/// verbatim (<c>Affitto|Utenze|Stipendi|Altro</c>), la stessa forma persistita a DB
/// (<c>HasConversion&lt;string&gt;()</c>) e usata dal frontend.
/// <para>
/// Con il default di GraphQL.NET (CONSTANT_CASE) il salvataggio di una spesa dalla cassa
/// falliva in coercizione con <c>Unable to convert 'Altro' to 'CategoriaSpesa'</c>: i test
/// esistenti non lo intercettavano perché invocano gli orchestrator direttamente, senza
/// passare dallo strato GraphQL.
/// </para>
/// </summary>
public class CategoriaSpesaGraphTypeTests
{
    private static Type FieldGraphType(IComplexGraphType graphType)
    {
        FieldType field = graphType.Fields
            .Single(f => string.Equals(f.Name, "categoria", StringComparison.OrdinalIgnoreCase));
        return field.Type!;
    }

    [Fact]
    public void Enum_EspostaConINomiDotNetVerbatim()
    {
        var type = new CategoriaSpesaGraphType();

        type.Name.Should().Be("CategoriaSpesa");
        type.Values.Select(v => v.Name).Should()
            .Equal("Affitto", "Utenze", "Stipendi", "Altro");
    }

    [Fact]
    public void ParseValue_AccettaPascalCase_ERifiutaConstantCase()
    {
        var type = new CategoriaSpesaGraphType();

        type.CanParseValue("Altro").Should().BeTrue();
        type.ParseValue("Altro").Should().Be(CategoriaSpesa.Altro);
        type.ParseValue("Affitto").Should().Be(CategoriaSpesa.Affitto);

        // Forma CONSTANT_CASE: era l'unica accettata prima del fix.
        type.CanParseValue("ALTRO").Should().BeFalse();
    }

    /// <summary>
    /// Ogni field `categoria` deve usare <see cref="CategoriaSpesaGraphType"/>: un residuo
    /// <c>EnumerationGraphType&lt;CategoriaSpesa&gt;</c> reintrodurrebbe il CONSTANT_CASE su
    /// quel field (e due casing diversi per lo stesso nome di tipo non possono coesistere).
    /// </summary>
    [Theory]
    [MemberData(nameof(TipiConCategoria))]
    public void OgniFieldCategoria_UsaIlGraphTypeDedicato(IComplexGraphType graphType)
    {
        Type fieldType = FieldGraphType(graphType);

        Type inner = fieldType.IsGenericType && fieldType.GetGenericTypeDefinition() == typeof(NonNullGraphType<>)
            ? fieldType.GetGenericArguments()[0]
            : fieldType;

        inner.Should().Be<CategoriaSpesaGraphType>();
    }

    public static TheoryData<IComplexGraphType> TipiConCategoria() =>
    [
        new SpesaCassaType(),
        new SpesaCassaInputType(),
        new PagamentoFornitoreRegistroInputType(),
        new AggiungiSpesaSuGiornoInputType(),
        new PagamentoFornitoreType(),
        new PagamentoFornitoreInputType(),
    ];
}
