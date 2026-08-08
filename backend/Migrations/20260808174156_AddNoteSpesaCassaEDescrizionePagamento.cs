using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteSpesaCassaEDescrizionePagamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "SpeseCassa",
                type: "longtext",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Descrizione",
                table: "PagamentiFornitori",
                type: "longtext",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            // Le spese fisse tracciate (nessun documento, categoria valorizzata) tenevano
            // la causale dentro Note, per mancanza di un campo proprio. Si sposta su
            // Descrizione e si libera Note, che torna a essere una vera annotazione.
            // I pagamenti documentali NON vengono toccati: la loro Note e gia una nota.
            migrationBuilder.Sql(@"
                UPDATE PagamentiFornitori
                   SET Descrizione = Note,
                       Note = NULL
                 WHERE FatturaId IS NULL
                   AND DdtId IS NULL
                   AND Categoria IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rimette la causale in Note prima di perdere la colonna Descrizione.
            migrationBuilder.Sql(@"
                UPDATE PagamentiFornitori
                   SET Note = Descrizione
                 WHERE FatturaId IS NULL
                   AND DdtId IS NULL
                   AND Categoria IS NOT NULL
                   AND Descrizione IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "SpeseCassa");

            migrationBuilder.DropColumn(
                name: "Descrizione",
                table: "PagamentiFornitori");
        }
    }
}
