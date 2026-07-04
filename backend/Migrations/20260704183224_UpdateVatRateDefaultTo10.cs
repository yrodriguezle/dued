using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class UpdateVatRateDefaultTo10 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "VatRate",
                table: "BusinessSettings",
                type: "decimal(5,4)",
                nullable: false,
                defaultValue: 0.10m,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,4)",
                oldDefaultValue: 0.22m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "VatRate",
                table: "BusinessSettings",
                type: "decimal(5,4)",
                nullable: false,
                defaultValue: 0.22m,
                oldClrType: typeof(decimal),
                oldType: "decimal(5,4)",
                oldDefaultValue: 0.10m);
        }
    }
}
