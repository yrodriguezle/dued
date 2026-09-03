using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class PaginaPiattoDellaSettimana : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ImmagineEroePiattoId",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PiattoGiorno",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<string>(
                name: "PiattoTesto",
                table: "ImpostazioniVetrina",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PiattoTitolo",
                table: "ImpostazioniVetrina",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroePiattoId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroePiattoId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ImpostazioniVetrina_PiattoGiorno",
                table: "ImpostazioniVetrina",
                sql: "`PiattoGiorno` BETWEEN 0 AND 6");

            migrationBuilder.AddForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroePiattoId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroePiattoId",
                principalTable: "MediaAssets",
                principalColumn: "MediaAssetId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroePiattoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroePiattoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ImpostazioniVetrina_PiattoGiorno",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "ImmagineEroePiattoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "PiattoGiorno",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "PiattoTesto",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "PiattoTitolo",
                table: "ImpostazioniVetrina");
        }
    }
}
