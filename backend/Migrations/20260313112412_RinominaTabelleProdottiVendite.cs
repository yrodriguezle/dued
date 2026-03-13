using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RinominaTabelleProdottiVendite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // === Drop foreign keys first (MySQL requires FK dropped before index) ===

            migrationBuilder.DropForeignKey(
                name: "FK_Sales_Products_ProductId",
                table: "Sales");

            migrationBuilder.DropForeignKey(
                name: "FK_Sales_RegistriCassa_RegistroCassaId",
                table: "Sales");

            // === Drop indexes ===

            migrationBuilder.DropIndex(
                name: "IX_Sales_ProductId",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_RegistroCassaId",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Sales_Timestamp",
                table: "Sales");

            migrationBuilder.DropIndex(
                name: "IX_Products_Code",
                table: "Products");

            // === Drop primary keys ===

            migrationBuilder.DropPrimaryKey(
                name: "PK_Sales",
                table: "Sales");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Products",
                table: "Products");

            // === Rename Products table and columns ===
            migrationBuilder.RenameTable(
                name: "Products",
                newName: "Prodotti");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "Prodotti",
                newName: "ProdottoId");

            migrationBuilder.RenameColumn(
                name: "Code",
                table: "Prodotti",
                newName: "Codice");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Prodotti",
                newName: "Nome");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "Prodotti",
                newName: "Descrizione");

            migrationBuilder.RenameColumn(
                name: "Price",
                table: "Prodotti",
                newName: "Prezzo");

            migrationBuilder.RenameColumn(
                name: "Category",
                table: "Prodotti",
                newName: "Categoria");

            migrationBuilder.RenameColumn(
                name: "UnitOfMeasure",
                table: "Prodotti",
                newName: "UnitaDiMisura");

            migrationBuilder.RenameColumn(
                name: "IsActive",
                table: "Prodotti",
                newName: "Attivo");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Prodotti",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "Prodotti",
                newName: "AggiornatoIl");

            // === Rename Sales table and columns ===
            migrationBuilder.RenameTable(
                name: "Sales",
                newName: "Vendite");

            migrationBuilder.RenameColumn(
                name: "SaleId",
                table: "Vendite",
                newName: "VenditaId");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "Vendite",
                newName: "ProdottoId");

            migrationBuilder.RenameColumn(
                name: "Quantity",
                table: "Vendite",
                newName: "Quantita");

            migrationBuilder.RenameColumn(
                name: "UnitPrice",
                table: "Vendite",
                newName: "PrezzoUnitario");

            migrationBuilder.RenameColumn(
                name: "TotalPrice",
                table: "Vendite",
                newName: "PrezzoTotale");

            migrationBuilder.RenameColumn(
                name: "Notes",
                table: "Vendite",
                newName: "Note");

            migrationBuilder.RenameColumn(
                name: "Timestamp",
                table: "Vendite",
                newName: "DataOra");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "Vendite",
                newName: "CreatoIl");

            migrationBuilder.RenameColumn(
                name: "UpdatedAt",
                table: "Vendite",
                newName: "AggiornatoIl");

            // RegistroCassaId stays the same — no rename needed

            // === Re-add primary keys with new names ===
            migrationBuilder.AddPrimaryKey(
                name: "PK_Prodotti",
                table: "Prodotti",
                column: "ProdottoId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Vendite",
                table: "Vendite",
                column: "VenditaId");

            // === Re-add foreign keys with new names ===
            migrationBuilder.AddForeignKey(
                name: "FK_Vendite_Prodotti_ProdottoId",
                table: "Vendite",
                column: "ProdottoId",
                principalTable: "Prodotti",
                principalColumn: "ProdottoId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Vendite_RegistriCassa_RegistroCassaId",
                table: "Vendite",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // === Re-add indexes with new names ===
            migrationBuilder.CreateIndex(
                name: "IX_Prodotti_Codice",
                table: "Prodotti",
                column: "Codice",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vendite_DataOra",
                table: "Vendite",
                column: "DataOra");

            migrationBuilder.CreateIndex(
                name: "IX_Vendite_ProdottoId",
                table: "Vendite",
                column: "ProdottoId");

            migrationBuilder.CreateIndex(
                name: "IX_Vendite_RegistroCassaId",
                table: "Vendite",
                column: "RegistroCassaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // === Drop new indexes and foreign keys ===
            migrationBuilder.DropIndex(
                name: "IX_Vendite_DataOra",
                table: "Vendite");

            migrationBuilder.DropIndex(
                name: "IX_Vendite_ProdottoId",
                table: "Vendite");

            migrationBuilder.DropIndex(
                name: "IX_Vendite_RegistroCassaId",
                table: "Vendite");

            migrationBuilder.DropIndex(
                name: "IX_Prodotti_Codice",
                table: "Prodotti");

            migrationBuilder.DropForeignKey(
                name: "FK_Vendite_Prodotti_ProdottoId",
                table: "Vendite");

            migrationBuilder.DropForeignKey(
                name: "FK_Vendite_RegistriCassa_RegistroCassaId",
                table: "Vendite");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Vendite",
                table: "Vendite");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Prodotti",
                table: "Prodotti");

            // === Rename Vendite back to Sales ===
            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "Vendite",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "Vendite",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "DataOra",
                table: "Vendite",
                newName: "Timestamp");

            migrationBuilder.RenameColumn(
                name: "Note",
                table: "Vendite",
                newName: "Notes");

            migrationBuilder.RenameColumn(
                name: "PrezzoTotale",
                table: "Vendite",
                newName: "TotalPrice");

            migrationBuilder.RenameColumn(
                name: "PrezzoUnitario",
                table: "Vendite",
                newName: "UnitPrice");

            migrationBuilder.RenameColumn(
                name: "Quantita",
                table: "Vendite",
                newName: "Quantity");

            migrationBuilder.RenameColumn(
                name: "ProdottoId",
                table: "Vendite",
                newName: "ProductId");

            migrationBuilder.RenameColumn(
                name: "VenditaId",
                table: "Vendite",
                newName: "SaleId");

            migrationBuilder.RenameTable(
                name: "Vendite",
                newName: "Sales");

            // === Rename Prodotti back to Products ===
            migrationBuilder.RenameColumn(
                name: "AggiornatoIl",
                table: "Prodotti",
                newName: "UpdatedAt");

            migrationBuilder.RenameColumn(
                name: "CreatoIl",
                table: "Prodotti",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "Attivo",
                table: "Prodotti",
                newName: "IsActive");

            migrationBuilder.RenameColumn(
                name: "UnitaDiMisura",
                table: "Prodotti",
                newName: "UnitOfMeasure");

            migrationBuilder.RenameColumn(
                name: "Categoria",
                table: "Prodotti",
                newName: "Category");

            migrationBuilder.RenameColumn(
                name: "Prezzo",
                table: "Prodotti",
                newName: "Price");

            migrationBuilder.RenameColumn(
                name: "Descrizione",
                table: "Prodotti",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "Nome",
                table: "Prodotti",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "Codice",
                table: "Prodotti",
                newName: "Code");

            migrationBuilder.RenameColumn(
                name: "ProdottoId",
                table: "Prodotti",
                newName: "ProductId");

            migrationBuilder.RenameTable(
                name: "Prodotti",
                newName: "Products");

            // === Re-add old primary keys ===
            migrationBuilder.AddPrimaryKey(
                name: "PK_Products",
                table: "Products",
                column: "ProductId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Sales",
                table: "Sales",
                column: "SaleId");

            // === Re-add old foreign keys ===
            migrationBuilder.AddForeignKey(
                name: "FK_Sales_Products_ProductId",
                table: "Sales",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "ProductId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_RegistriCassa_RegistroCassaId",
                table: "Sales",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // === Re-add old indexes ===
            migrationBuilder.CreateIndex(
                name: "IX_Products_Code",
                table: "Products",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sales_ProductId",
                table: "Sales",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_RegistroCassaId",
                table: "Sales",
                column: "RegistroCassaId");

            migrationBuilder.CreateIndex(
                name: "IX_Sales_Timestamp",
                table: "Sales",
                column: "Timestamp");
        }
    }
}
