using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BusinessSettings",
                columns: table => new
                {
                    SettingsId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    BusinessName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OpeningTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, defaultValue: "09:00", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ClosingTime = table.Column<string>(type: "varchar(5)", maxLength: 5, nullable: false, defaultValue: "18:00", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    OperatingDays = table.Column<string>(type: "json", nullable: false, defaultValue: "[true,true,true,true,true,false,false]", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Timezone = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, defaultValue: "Europe/Rome", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Currency = table.Column<string>(type: "varchar(3)", maxLength: 3, nullable: false, defaultValue: "EUR", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    VatRate = table.Column<decimal>(type: "decimal(5,4)", nullable: false, defaultValue: 0.22m),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessSettings", x => x.SettingsId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessSettings");
        }
    }
}
