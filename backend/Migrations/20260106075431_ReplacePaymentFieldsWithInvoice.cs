using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePaymentFieldsWithInvoice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NexiPayments",
                table: "CashRegisters");

            migrationBuilder.RenameColumn(
                name: "SatispayPayments",
                table: "CashRegisters",
                newName: "InvoicePayments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "InvoicePayments",
                table: "CashRegisters",
                newName: "SatispayPayments");

            migrationBuilder.AddColumn<decimal>(
                name: "NexiPayments",
                table: "CashRegisters",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
