using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class ExpandProvinciaMaxLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // La colonna potrebbe non esistere se il DB è stato creato senza di essa
            migrationBuilder.Sql(@"
                SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Fornitori' AND COLUMN_NAME = 'Provincia');
                SET @sql = IF(@col_exists > 0,
                    'ALTER TABLE `Fornitori` MODIFY COLUMN `Provincia` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL',
                    'ALTER TABLE `Fornitori` ADD COLUMN `Provincia` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Provincia",
                table: "Fornitori",
                type: "varchar(2)",
                maxLength: 2,
                nullable: true,
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "varchar(100)",
                oldMaxLength: 100,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }
    }
}
