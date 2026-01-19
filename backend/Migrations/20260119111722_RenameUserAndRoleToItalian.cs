using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RenameUserAndRoleToItalian : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CashRegisters_Users_UserId",
                table: "CashRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users");

            migrationBuilder.RenameTable(
                name: "Users",
                newSchema: null,
                newName: "Utenti");

            migrationBuilder.RenameTable(
                name: "Roles",
                newSchema: null,
                newName: "Ruoli");

            migrationBuilder.RenameColumn(
                name: "UserName",
                table: "Utenti",
                newName: "NomeUtente");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "Utenti",
                newName: "RuoloId");

            migrationBuilder.RenameColumn(
                name: "RefreshTokenExpiresAt",
                table: "Utenti",
                newName: "ScadenzaTokenAggiornamento");

            migrationBuilder.RenameColumn(
                name: "RefreshToken",
                table: "Utenti",
                newName: "TokenAggiornamento");

            migrationBuilder.RenameColumn(
                name: "LastName",
                table: "Utenti",
                newName: "Cognome");

            migrationBuilder.RenameColumn(
                name: "FirstName",
                table: "Utenti",
                newName: "Nome");

            migrationBuilder.RenameColumn(
                name: "Disabled",
                table: "Utenti",
                newName: "Disabilitato");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "Utenti",
                newName: "Descrizione");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "Utenti",
                newName: "Id");

            migrationBuilder.RenameIndex(
                name: "IX_Users_RoleId",
                table: "Utenti",
                newName: "IX_Utenti_RuoloId");

            migrationBuilder.RenameColumn(
                name: "RoleName",
                table: "Ruoli",
                newName: "Nome");

            migrationBuilder.RenameColumn(
                name: "RoleDescription",
                table: "Ruoli",
                newName: "Descrizione");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "Ruoli",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "CashRegisters",
                newName: "UtenteId");

            migrationBuilder.RenameIndex(
                name: "IX_CashRegisters_UserId",
                table: "CashRegisters",
                newName: "IX_CashRegisters_UtenteId");

            migrationBuilder.AddForeignKey(
                name: "FK_CashRegisters_Utenti_UtenteId",
                table: "CashRegisters",
                column: "UtenteId",
                principalTable: "Utenti",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Utenti_Ruoli_RuoloId",
                table: "Utenti",
                column: "RuoloId",
                principalTable: "Ruoli",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CashRegisters_Utenti_UtenteId",
                table: "CashRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_Utenti_Ruoli_RuoloId",
                table: "Utenti");

            migrationBuilder.RenameColumn(
                name: "TokenAggiornamento",
                table: "Utenti",
                newName: "RefreshToken");

            migrationBuilder.RenameColumn(
                name: "ScadenzaTokenAggiornamento",
                table: "Utenti",
                newName: "RefreshTokenExpiresAt");

            migrationBuilder.RenameColumn(
                name: "RuoloId",
                table: "Utenti",
                newName: "RoleId");

            migrationBuilder.RenameColumn(
                name: "NomeUtente",
                table: "Utenti",
                newName: "UserName");

            migrationBuilder.RenameColumn(
                name: "Nome",
                table: "Utenti",
                newName: "FirstName");

            migrationBuilder.RenameColumn(
                name: "Disabilitato",
                table: "Utenti",
                newName: "Disabled");

            migrationBuilder.RenameColumn(
                name: "Descrizione",
                table: "Utenti",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "Cognome",
                table: "Utenti",
                newName: "LastName");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "Utenti",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Utenti_RuoloId",
                table: "Utenti",
                newName: "IX_Users_RoleId");

            migrationBuilder.RenameColumn(
                name: "Nome",
                table: "Ruoli",
                newName: "RoleName");

            migrationBuilder.RenameColumn(
                name: "Descrizione",
                table: "Ruoli",
                newName: "RoleDescription");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "Ruoli",
                newName: "RoleId");

            migrationBuilder.RenameColumn(
                name: "UtenteId",
                table: "CashRegisters",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "IX_CashRegisters_UtenteId",
                table: "CashRegisters",
                newName: "IX_CashRegisters_UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_CashRegisters_Users_UserId",
                table: "CashRegisters",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users",
                column: "RoleId",
                principalTable: "Roles",
                principalColumn: "RoleId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.RenameTable(
                name: "Utenti",
                newSchema: null,
                newName: "Users");

            migrationBuilder.RenameTable(
                name: "Ruoli",
                newSchema: null,
                newName: "Roles");
        }
    }
}
