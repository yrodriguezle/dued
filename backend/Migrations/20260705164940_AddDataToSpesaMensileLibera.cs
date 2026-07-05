using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class AddDataToSpesaMensileLibera : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "Data",
                table: "SpeseMensiliLibere",
                type: "date",
                nullable: true);

            // Backfill idempotente: assegna alle spese storiche la data del primo giorno
            // del mese/anno della chiusura di appartenenza. Il filtro "Data IS NULL" rende
            // la migration ri-eseguibile senza sovrascrivere date già valorizzate.
            migrationBuilder.Sql(
                "UPDATE SpeseMensiliLibere s " +
                "INNER JOIN ChiusureMensili c ON s.ChiusuraId = c.ChiusuraId " +
                "SET s.Data = STR_TO_DATE(CONCAT(c.Anno, '-', LPAD(c.Mese, 2, '0'), '-01'), '%Y-%m-%d') " +
                "WHERE s.Data IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Data",
                table: "SpeseMensiliLibere");
        }
    }
}
