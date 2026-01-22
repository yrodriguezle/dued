using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RenameRoleMenuAndMenuColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create helper procedure to safely drop foreign key if exists
            migrationBuilder.Sql(@"
                DROP PROCEDURE IF EXISTS `SafeDropForeignKey`;
                CREATE PROCEDURE `SafeDropForeignKey`(IN tableName VARCHAR(255), IN constraintName VARCHAR(255))
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                        WHERE CONSTRAINT_SCHEMA = DATABASE()
                        AND TABLE_NAME = tableName
                        AND CONSTRAINT_NAME = constraintName
                        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                    ) THEN
                        SET @sql = CONCAT('ALTER TABLE `', tableName, '` DROP FOREIGN KEY `', constraintName, '`');
                        PREPARE stmt FROM @sql;
                        EXECUTE stmt;
                        DEALLOCATE PREPARE stmt;
                    END IF;
                END;
            ");

            // Drop foreign keys using the safe procedure
            migrationBuilder.Sql("CALL SafeDropForeignKey('RoleMenu', 'FK_RoleMenu_roles_RoleId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('RoleMenu', 'FK_RoleMenu_menus_MenuId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('Menus', 'FK_Menus_Menus_ParentMenuId');");

            // Drop primary key and index on RoleMenu
            migrationBuilder.Sql(@"
                SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RoleMenu' AND INDEX_NAME = 'PRIMARY');
                SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE `RoleMenu` DROP PRIMARY KEY', 'SELECT 1');
                PREPARE stmt FROM @sqlstmt;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");

            migrationBuilder.Sql(@"
                SET @exist := (SELECT COUNT(*) FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RoleMenu' AND INDEX_NAME = 'IX_RoleMenu_RoleId');
                SET @sqlstmt := IF(@exist > 0, 'ALTER TABLE `RoleMenu` DROP INDEX `IX_RoleMenu_RoleId`', 'SELECT 1');
                PREPARE stmt FROM @sqlstmt;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");

            // Rename columns in Menus table
            migrationBuilder.RenameColumn(
                name: "MenuId",
                table: "Menus",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "Menus",
                newName: "Titolo");

            migrationBuilder.RenameColumn(
                name: "Path",
                table: "Menus",
                newName: "Percorso");

            migrationBuilder.RenameColumn(
                name: "Icon",
                table: "Menus",
                newName: "Icona");

            migrationBuilder.RenameColumn(
                name: "IsVisible",
                table: "Menus",
                newName: "Visibile");

            migrationBuilder.RenameColumn(
                name: "Position",
                table: "Menus",
                newName: "Posizione");

            migrationBuilder.RenameColumn(
                name: "FilePath",
                table: "Menus",
                newName: "PercorsoFile");

            migrationBuilder.RenameColumn(
                name: "ViewName",
                table: "Menus",
                newName: "NomeVista");

            migrationBuilder.RenameColumn(
                name: "ParentMenuId",
                table: "Menus",
                newName: "MenuPadreId");

            migrationBuilder.RenameIndex(
                name: "IX_Menus_ParentMenuId",
                table: "Menus",
                newName: "IX_Menus_MenuPadreId");

            // Rename RoleMenu table to RuoloMenu and column RoleId to RuoloId
            migrationBuilder.RenameTable(
                name: "RoleMenu",
                newName: "RuoloMenu");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "RuoloMenu",
                newName: "RuoloId");

            // Recreate primary key and indexes
            migrationBuilder.AddPrimaryKey(
                name: "PK_RuoloMenu",
                table: "RuoloMenu",
                columns: new[] { "MenuId", "RuoloId" });

            migrationBuilder.CreateIndex(
                name: "IX_RuoloMenu_RuoloId",
                table: "RuoloMenu",
                column: "RuoloId");

            // Recreate foreign keys with new names
            migrationBuilder.AddForeignKey(
                name: "FK_Menus_Menus_MenuPadreId",
                table: "Menus",
                column: "MenuPadreId",
                principalTable: "Menus",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RuoloMenu_Menus_MenuId",
                table: "RuoloMenu",
                column: "MenuId",
                principalTable: "Menus",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RuoloMenu_Ruoli_RuoloId",
                table: "RuoloMenu",
                column: "RuoloId",
                principalTable: "Ruoli",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // Clean up helper procedure
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS `SafeDropForeignKey`;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop foreign keys
            migrationBuilder.DropForeignKey(
                name: "FK_Menus_Menus_MenuPadreId",
                table: "Menus");

            migrationBuilder.DropForeignKey(
                name: "FK_RuoloMenu_Menus_MenuId",
                table: "RuoloMenu");

            migrationBuilder.DropForeignKey(
                name: "FK_RuoloMenu_Ruoli_RuoloId",
                table: "RuoloMenu");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RuoloMenu",
                table: "RuoloMenu");

            migrationBuilder.DropIndex(
                name: "IX_RuoloMenu_RuoloId",
                table: "RuoloMenu");

            // Rename RuoloMenu back to RoleMenu
            migrationBuilder.RenameColumn(
                name: "RuoloId",
                table: "RuoloMenu",
                newName: "RoleId");

            migrationBuilder.RenameTable(
                name: "RuoloMenu",
                newName: "RoleMenu");

            // Rename columns in Menus table back to English
            migrationBuilder.RenameColumn(
                name: "Id",
                table: "Menus",
                newName: "MenuId");

            migrationBuilder.RenameColumn(
                name: "Titolo",
                table: "Menus",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "Percorso",
                table: "Menus",
                newName: "Path");

            migrationBuilder.RenameColumn(
                name: "Icona",
                table: "Menus",
                newName: "Icon");

            migrationBuilder.RenameColumn(
                name: "Visibile",
                table: "Menus",
                newName: "IsVisible");

            migrationBuilder.RenameColumn(
                name: "Posizione",
                table: "Menus",
                newName: "Position");

            migrationBuilder.RenameColumn(
                name: "PercorsoFile",
                table: "Menus",
                newName: "FilePath");

            migrationBuilder.RenameColumn(
                name: "NomeVista",
                table: "Menus",
                newName: "ViewName");

            migrationBuilder.RenameColumn(
                name: "MenuPadreId",
                table: "Menus",
                newName: "ParentMenuId");

            migrationBuilder.RenameIndex(
                name: "IX_Menus_MenuPadreId",
                table: "Menus",
                newName: "IX_Menus_ParentMenuId");

            // Recreate primary key and indexes
            migrationBuilder.AddPrimaryKey(
                name: "PK_RoleMenu",
                table: "RoleMenu",
                columns: new[] { "MenuId", "RoleId" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleMenu_RoleId",
                table: "RoleMenu",
                column: "RoleId");

            // Recreate foreign keys
            migrationBuilder.AddForeignKey(
                name: "FK_Menus_Menus_ParentMenuId",
                table: "Menus",
                column: "ParentMenuId",
                principalTable: "Menus",
                principalColumn: "MenuId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RoleMenu_menus_MenuId",
                table: "RoleMenu",
                column: "MenuId",
                principalTable: "Menus",
                principalColumn: "MenuId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RoleMenu_roles_RoleId",
                table: "RoleMenu",
                column: "RoleId",
                principalTable: "Ruoli",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
