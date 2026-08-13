using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class SlotImmaginiPagineVetrina : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ImmagineEroeHomeId",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroeAperitivoId");

            migrationBuilder.CreateIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroeHomeId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroeHomeId");

            migrationBuilder.CreateIndex(
                name: "IX_ImpostazioniVetrina_ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina",
                column: "ImmagineRitrattoLocaleId");

            migrationBuilder.AddForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroeAperitivoId",
                principalTable: "MediaAssets",
                principalColumn: "MediaAssetId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroeHomeId",
                table: "ImpostazioniVetrina",
                column: "ImmagineEroeHomeId",
                principalTable: "MediaAssets",
                principalColumn: "MediaAssetId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina",
                column: "ImmagineRitrattoLocaleId",
                principalTable: "MediaAssets",
                principalColumn: "MediaAssetId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineEroeHomeId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropForeignKey(
                name: "FK_ImpostazioniVetrina_MediaAssets_ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropIndex(
                name: "IX_ImpostazioniVetrina_ImmagineEroeHomeId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropIndex(
                name: "IX_ImpostazioniVetrina_ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "ImmagineEroeAperitivoId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "ImmagineEroeHomeId",
                table: "ImpostazioniVetrina");

            migrationBuilder.DropColumn(
                name: "ImmagineRitrattoLocaleId",
                table: "ImpostazioniVetrina");
        }
    }
}
