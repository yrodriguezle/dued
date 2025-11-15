using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddCashManagementTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CashDenominations",
                columns: table => new
                {
                    DenominationId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Value = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Type = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashDenominations", x => x.DenominationId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "CashRegisters",
                columns: table => new
                {
                    RegisterId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Date = table.Column<DateTime>(type: "date", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    OpeningTotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ClosingTotal = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    CashSales = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ElectronicPayments = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    TotalSales = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    SupplierExpenses = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    DailyExpenses = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ExpectedCash = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Difference = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    NetCash = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "DRAFT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashRegisters", x => x.RegisterId);
                    table.ForeignKey(
                        name: "FK_CashRegisters_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "CashCounts",
                columns: table => new
                {
                    CountId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RegisterId = table.Column<int>(type: "int", nullable: false),
                    DenominationId = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Total = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    IsOpening = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashCounts", x => x.CountId);
                    table.ForeignKey(
                        name: "FK_CashCounts_CashDenominations_DenominationId",
                        column: x => x.DenominationId,
                        principalTable: "CashDenominations",
                        principalColumn: "DenominationId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashCounts_CashRegisters_RegisterId",
                        column: x => x.RegisterId,
                        principalTable: "CashRegisters",
                        principalColumn: "RegisterId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_CashCounts_DenominationId",
                table: "CashCounts",
                column: "DenominationId");

            migrationBuilder.CreateIndex(
                name: "IX_CashCounts_RegisterId",
                table: "CashCounts",
                column: "RegisterId");

            migrationBuilder.CreateIndex(
                name: "IX_CashRegisters_UserId",
                table: "CashRegisters",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CashCounts");

            migrationBuilder.DropTable(
                name: "CashDenominations");

            migrationBuilder.DropTable(
                name: "CashRegisters");
        }
    }
}
