using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class CategorieSpesaConfigurabili : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CategorieSpesa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Nome = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Attiva = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: true),
                    Ordine = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategorieSpesa", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            // ── Seed delle categorie canoniche (le stesse dell'enum precedente) ──
            migrationBuilder.Sql(
                "INSERT INTO CategorieSpesa (Nome, Attiva, Ordine) VALUES " +
                "('Affitto', 1, 0), ('Utenze', 1, 1), ('Stipendi', 1, 2), ('Altro', 1, 3);");

            // Colonne FK prima nullable: il backfill le valorizza, poi quelle NOT NULL si vincolano.
            migrationBuilder.AddColumn<int>(
                name: "CategoriaId",
                table: "SpeseCassa",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CategoriaId",
                table: "PagamentiFornitori",
                type: "int",
                nullable: true);

            // Backfill: associa gli id a partire dal vecchio NOME stringa. Qualunque valore
            // non riconosciuto ricade su 'Altro' (come faceva il default dell'enum).
            migrationBuilder.Sql(
                "UPDATE SpeseCassa s " +
                "LEFT JOIN CategorieSpesa c ON c.Nome = s.Categoria " +
                "SET s.CategoriaId = COALESCE(c.Id, (SELECT Id FROM CategorieSpesa WHERE Nome = 'Altro'));");

            migrationBuilder.Sql(
                "UPDATE PagamentiFornitori p " +
                "LEFT JOIN CategorieSpesa c ON c.Nome = p.Categoria " +
                "SET p.CategoriaId = c.Id " +
                "WHERE p.Categoria IS NOT NULL AND p.Categoria <> '';");

            // Ora la FK per le spese non tracciate è sempre valorizzata: la rendiamo NOT NULL.
            migrationBuilder.AlterColumn<int>(
                name: "CategoriaId",
                table: "SpeseCassa",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            // Drop delle vecchie colonne stringa (i dati sono stati migrati).
            migrationBuilder.DropColumn(
                name: "Categoria",
                table: "SpeseCassa");

            migrationBuilder.DropColumn(
                name: "Categoria",
                table: "PagamentiFornitori");

            migrationBuilder.AddColumn<decimal>(
                name: "SaldoInizialeCassa",
                table: "BusinessSettings",
                type: "decimal(10,2)",
                nullable: false,
                defaultValue: 0.00m);

            migrationBuilder.CreateIndex(
                name: "IX_SpeseCassa_CategoriaId",
                table: "SpeseCassa",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_CategoriaId",
                table: "PagamentiFornitori",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_CategorieSpesa_Nome",
                table: "CategorieSpesa",
                column: "Nome",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PagamentiFornitori_CategorieSpesa_CategoriaId",
                table: "PagamentiFornitori",
                column: "CategoriaId",
                principalTable: "CategorieSpesa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SpeseCassa_CategorieSpesa_CategoriaId",
                table: "SpeseCassa",
                column: "CategoriaId",
                principalTable: "CategorieSpesa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PagamentiFornitori_CategorieSpesa_CategoriaId",
                table: "PagamentiFornitori");

            migrationBuilder.DropForeignKey(
                name: "FK_SpeseCassa_CategorieSpesa_CategoriaId",
                table: "SpeseCassa");

            migrationBuilder.DropTable(
                name: "CategorieSpesa");

            migrationBuilder.DropIndex(
                name: "IX_SpeseCassa_CategoriaId",
                table: "SpeseCassa");

            migrationBuilder.DropIndex(
                name: "IX_PagamentiFornitori_CategoriaId",
                table: "PagamentiFornitori");

            // Ripristina le colonne stringa, copiando il nome dalla nuova tabella (best effort).
            migrationBuilder.AddColumn<string>(
                name: "Categoria",
                table: "SpeseCassa",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Altro",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Categoria",
                table: "PagamentiFornitori",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(
                "UPDATE SpeseCassa s LEFT JOIN CategorieSpesa c ON c.Id = s.CategoriaId " +
                "SET s.Categoria = COALESCE(c.Nome, 'Altro');");

            migrationBuilder.Sql(
                "UPDATE PagamentiFornitori p LEFT JOIN CategorieSpesa c ON c.Id = p.CategoriaId " +
                "SET p.Categoria = c.Nome WHERE p.CategoriaId IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "CategoriaId",
                table: "SpeseCassa");

            migrationBuilder.DropColumn(
                name: "CategoriaId",
                table: "PagamentiFornitori");

            migrationBuilder.DropColumn(
                name: "SaldoInizialeCassa",
                table: "BusinessSettings");
        }
    }
}
