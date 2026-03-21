using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddGiorniNonLavorativi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GiorniNonLavorativi",
                columns: table => new
                {
                    GiornoId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Data = table.Column<DateOnly>(type: "date", nullable: false),
                    Descrizione = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CodiceMotivo = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, defaultValue: "FESTIVITA_NAZIONALE", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Ricorrente = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    SettingsId = table.Column<int>(type: "int", nullable: false),
                    CreatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    AggiornatoIl = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GiorniNonLavorativi", x => x.GiornoId);
                    table.ForeignKey(
                        name: "FK_GiorniNonLavorativi_BusinessSettings_SettingsId",
                        column: x => x.SettingsId,
                        principalTable: "BusinessSettings",
                        principalColumn: "SettingsId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_GiorniNonLavorativi_SettingsId_Data",
                table: "GiorniNonLavorativi",
                columns: new[] { "SettingsId", "Data" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GiorniNonLavorativi");
        }
    }
}
