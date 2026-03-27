using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RemoveIncassiCassaTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Safety-copy: sincronizza i campi flat di RegistriCassa dai record IncassiCassa
            // dove i campi flat sono a zero ma esistono valori nella collection.
            // Questo previene qualsiasi perdita di dati prima del DROP TABLE.
            migrationBuilder.Sql(@"
                UPDATE RegistriCassa rc
                SET rc.IncassoContanteTracciato = COALESCE((
                    SELECT ic.Importo FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo IN ('Pago in contanti', 'Pago in Bianco (Contante)')
                    LIMIT 1
                ), rc.IncassoContanteTracciato)
                WHERE rc.IncassoContanteTracciato = 0
                AND EXISTS (
                    SELECT 1 FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo IN ('Pago in contanti', 'Pago in Bianco (Contante)') AND ic.Importo > 0
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE RegistriCassa rc
                SET rc.IncassiElettronici = COALESCE((
                    SELECT ic.Importo FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo = 'Pagamenti Elettronici'
                    LIMIT 1
                ), rc.IncassiElettronici)
                WHERE rc.IncassiElettronici = 0
                AND EXISTS (
                    SELECT 1 FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo = 'Pagamenti Elettronici' AND ic.Importo > 0
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE RegistriCassa rc
                SET rc.IncassiFattura = COALESCE((
                    SELECT ic.Importo FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo = 'Pagamento con Fattura'
                    LIMIT 1
                ), rc.IncassiFattura)
                WHERE rc.IncassiFattura = 0
                AND EXISTS (
                    SELECT 1 FROM IncassiCassa ic
                    WHERE ic.RegistroCassaId = rc.Id AND ic.Tipo = 'Pagamento con Fattura' AND ic.Importo > 0
                );
            ");

            migrationBuilder.DropTable(
                name: "IncassiCassa");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IncassiCassa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegistroCassaId = table.Column<int>(type: "int", nullable: false),
                    Importo = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Tipo = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncassiCassa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncassiCassa_RegistriCassa_RegistroCassaId",
                        column: x => x.RegistroCassaId,
                        principalTable: "RegistriCassa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_IncassiCassa_RegistroCassaId",
                table: "IncassiCassa",
                column: "RegistroCassaId");
        }
    }
}
