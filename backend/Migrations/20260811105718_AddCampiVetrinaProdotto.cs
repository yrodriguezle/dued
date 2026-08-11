using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddCampiVetrinaProdotto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Allergeni",
                table: "Prodotti",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CategoriaVetrina",
                table: "Prodotti",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "Consigliato",
                table: "Prodotti",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DescrizioneVetrina",
                table: "Prodotti",
                type: "text",
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "ImmagineId",
                table: "Prodotti",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomeVetrina",
                table: "Prodotti",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true,
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "Novita",
                table: "Prodotti",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OrdinamentoVetrina",
                table: "Prodotti",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "PrezzoVetrina",
                table: "Prodotti",
                type: "decimal(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "VisibileSulSito",
                table: "Prodotti",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_Prodotti_ImmagineId",
                table: "Prodotti",
                column: "ImmagineId");

            migrationBuilder.CreateIndex(
                name: "IX_Prodotti_VisibileSulSito",
                table: "Prodotti",
                column: "VisibileSulSito");

            migrationBuilder.AddForeignKey(
                name: "FK_Prodotti_MediaAssets_ImmagineId",
                table: "Prodotti",
                column: "ImmagineId",
                principalTable: "MediaAssets",
                principalColumn: "MediaAssetId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Prodotti_MediaAssets_ImmagineId",
                table: "Prodotti");

            migrationBuilder.DropIndex(
                name: "IX_Prodotti_ImmagineId",
                table: "Prodotti");

            migrationBuilder.DropIndex(
                name: "IX_Prodotti_VisibileSulSito",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "Allergeni",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "CategoriaVetrina",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "Consigliato",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "DescrizioneVetrina",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "ImmagineId",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "NomeVetrina",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "Novita",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "OrdinamentoVetrina",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "PrezzoVetrina",
                table: "Prodotti");

            migrationBuilder.DropColumn(
                name: "VisibileSulSito",
                table: "Prodotti");
        }
    }
}
