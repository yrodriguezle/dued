using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistroCassaIdToPagamentiFornitori : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RegistroCassaId",
                table: "PagamentiFornitori",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PagamentiFornitori_RegistroCassaId",
                table: "PagamentiFornitori",
                column: "RegistroCassaId");

            migrationBuilder.AddForeignKey(
                name: "FK_PagamentiFornitori_RegistriCassa_RegistroCassaId",
                table: "PagamentiFornitori",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PagamentiFornitori_RegistriCassa_RegistroCassaId",
                table: "PagamentiFornitori");

            migrationBuilder.DropIndex(
                name: "IX_PagamentiFornitori_RegistroCassaId",
                table: "PagamentiFornitori");

            migrationBuilder.DropColumn(
                name: "RegistroCassaId",
                table: "PagamentiFornitori");
        }
    }
}
