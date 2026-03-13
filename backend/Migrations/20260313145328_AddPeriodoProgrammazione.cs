using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddPeriodoProgrammazione : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PeriodiProgrammazione",
                columns: table => new
                {
                    PeriodoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    DataInizio = table.Column<DateOnly>(type: "date", nullable: false),
                    DataFine = table.Column<DateOnly>(type: "date", nullable: true),
                    GiorniOperativi = table.Column<string>(type: "json", nullable: false, defaultValue: "[true,true,true,true,true,false,false]", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SettingsId = table.Column<int>(type: "int", nullable: false),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeriodiProgrammazione", x => x.PeriodoId);
                    table.ForeignKey(
                        name: "FK_PeriodiProgrammazione_BusinessSettings_SettingsId",
                        column: x => x.SettingsId,
                        principalTable: "BusinessSettings",
                        principalColumn: "SettingsId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_PeriodiProgrammazione_SettingsId_DataInizio",
                table: "PeriodiProgrammazione",
                columns: new[] { "SettingsId", "DataInizio" });

            // Seed: copia i giorni operativi dal primo BusinessSettings come periodo attivo iniziale
            migrationBuilder.Sql(@"
                INSERT INTO PeriodiProgrammazione (DataInizio, DataFine, GiorniOperativi, SettingsId, CreatoIl, AggiornatoIl)
                SELECT '2024-01-01', NULL, OperatingDays, SettingsId, NOW(), NOW()
                FROM BusinessSettings
                LIMIT 1;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PeriodiProgrammazione");
        }
    }
}
