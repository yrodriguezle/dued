using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddOrariPeriodoProgrammazione : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "OrarioApertura",
                table: "PeriodiProgrammazione",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(9, 0, 0));

            migrationBuilder.AddColumn<TimeOnly>(
                name: "OrarioChiusura",
                table: "PeriodiProgrammazione",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(18, 0, 0));

            // Popola i periodi esistenti con gli orari da BusinessSettings
            migrationBuilder.Sql(@"
                UPDATE PeriodiProgrammazione pp
                JOIN BusinessSettings bs ON pp.SettingsId = bs.SettingsId
                SET pp.OrarioApertura = STR_TO_DATE(bs.OpeningTime, '%H:%i'),
                    pp.OrarioChiusura = STR_TO_DATE(bs.ClosingTime, '%H:%i')
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OrarioApertura",
                table: "PeriodiProgrammazione");

            migrationBuilder.DropColumn(
                name: "OrarioChiusura",
                table: "PeriodiProgrammazione");
        }
    }
}
