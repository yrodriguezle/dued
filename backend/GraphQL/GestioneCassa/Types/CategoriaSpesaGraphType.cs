using GraphQL.Types;
using duedgusto.Models;

namespace duedgusto.GraphQL.GestioneCassa.Types;

/// <summary>
/// Enum GraphQL per <see cref="CategoriaSpesa"/> che espone i nomi .NET verbatim
/// (<c>Affitto|Utenze|Stipendi|Altro</c>) invece del CONSTANT_CASE applicato di default da
/// GraphQL.NET (<c>AFFITTO|UTENZE|...</c>).
/// <para>
/// Il valore è persistito come stringa PascalCase (<c>HasConversion&lt;string&gt;()</c> in
/// <c>AppDbContext</c>) ed è nella stessa forma nel frontend (union <c>CategoriaSpesa</c> e
/// tendina della griglia spese): un unico formato su DB, API e client. Senza questo tipo la
/// coercizione della variabile fallisce con
/// <c>Unable to convert 'Altro' to 'CategoriaSpesa'</c>.
/// </para>
/// Va usato al posto di <c>EnumerationGraphType&lt;CategoriaSpesa&gt;</c> in TUTTI i field:
/// due registrazioni con casing diverso per lo stesso nome di tipo non possono coesistere.
/// </summary>
public class CategoriaSpesaGraphType : EnumerationGraphType<CategoriaSpesa>
{
    public CategoriaSpesaGraphType()
    {
        Name = "CategoriaSpesa";
    }

    protected override string ChangeEnumCase(string val) => val;
}
