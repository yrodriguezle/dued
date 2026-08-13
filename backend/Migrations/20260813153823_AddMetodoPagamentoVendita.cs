using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddMetodoPagamentoVendita : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MetodoPagamento",
                table: "Vendite",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "CONTANTE_NON_TRACCIATO",
                collation: "utf8mb4_unicode_ci")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MetodoPagamento",
                table: "Vendite");
        }
    }
}
