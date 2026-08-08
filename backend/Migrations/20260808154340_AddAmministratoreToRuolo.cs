using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddAmministratoreToRuolo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Amministratore",
                table: "Ruoli",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            // I ruoli amministrativi già esistenti mantengono i privilegi: senza questo
            // update nessuno potrebbe riaprire un registro finché non si spunta la casella
            // a mano nell'anagrafica ruoli.
            migrationBuilder.Sql(
                "UPDATE Ruoli SET Amministratore = 1 WHERE Nome IN ('SuperAdmin', 'Admin');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amministratore",
                table: "Ruoli");
        }
    }
}
