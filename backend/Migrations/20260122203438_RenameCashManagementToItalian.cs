using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace duedgusto.Migrations
{
    /// <inheritdoc />
    public partial class RenameCashManagementToItalian : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create stored procedure for safely dropping foreign keys if it doesn't exist
            migrationBuilder.Sql(@"
                DROP PROCEDURE IF EXISTS SafeDropForeignKey;
            ");

            migrationBuilder.Sql(@"
                CREATE PROCEDURE SafeDropForeignKey(
                    IN tableName VARCHAR(255),
                    IN constraintName VARCHAR(255)
                )
                BEGIN
                    DECLARE keyExists INT DEFAULT 0;

                    SELECT COUNT(*) INTO keyExists
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = tableName
                      AND CONSTRAINT_NAME = constraintName
                      AND CONSTRAINT_TYPE = 'FOREIGN KEY';

                    IF keyExists > 0 THEN
                        SET @sql = CONCAT('ALTER TABLE `', tableName, '` DROP FOREIGN KEY `', constraintName, '`');
                        PREPARE stmt FROM @sql;
                        EXECUTE stmt;
                        DEALLOCATE PREPARE stmt;
                    END IF;
                END;
            ");

            // Drop foreign keys first
            migrationBuilder.Sql("CALL SafeDropForeignKey('CashCounts', 'FK_CashCounts_CashDenominations_DenominationId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('CashCounts', 'FK_CashCounts_CashRegisters_RegisterId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('CashExpenses', 'FK_CashExpenses_CashRegisters_RegisterId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('CashIncomes', 'FK_CashIncomes_CashRegisters_RegisterId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('CashRegisters', 'FK_CashRegisters_Utenti_UtenteId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('Sales', 'FK_Sales_CashRegisters_RegisterId');");

            // Rename CashDenominations table and columns using MySQL 8.0 syntax
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `DenominationId` TO `Id`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `Value` TO `Valore`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `Type` TO `Tipo`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `DisplayOrder` TO `OrdineVisualizzazione`;");
            migrationBuilder.Sql("RENAME TABLE `CashDenominations` TO `DenominazioniMoneta`;");

            // Rename CashRegisters table and columns
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `RegisterId` TO `Id`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Date` TO `Data`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `OpeningTotal` TO `TotaleApertura`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ClosingTotal` TO `TotaleChiusura`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `CashSales` TO `VenditeContanti`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `CashInWhite` TO `IncassoContanteTracciato`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ElectronicPayments` TO `IncassiElettronici`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `InvoicePayments` TO `IncassiFattura`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `TotalSales` TO `TotaleVendite`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `SupplierExpenses` TO `SpeseFornitori`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `DailyExpenses` TO `SpeseGiornaliere`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ExpectedCash` TO `ContanteAtteso`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Difference` TO `Differenza`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `NetCash` TO `ContanteNetto`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `VatAmount` TO `ImportoIva`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Notes` TO `Note`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Status` TO `Stato`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `CreatedAt` TO `CreatoIl`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `UpdatedAt` TO `AggiornatoIl`;");
            migrationBuilder.Sql("DROP INDEX `IX_CashRegisters_Date` ON `CashRegisters`;");
            migrationBuilder.Sql("CREATE UNIQUE INDEX `IX_RegistriCassa_Data` ON `CashRegisters` (`Data`);");
            migrationBuilder.Sql("DROP INDEX `IX_CashRegisters_UtenteId` ON `CashRegisters`;");
            migrationBuilder.Sql("CREATE INDEX `IX_RegistriCassa_UtenteId` ON `CashRegisters` (`UtenteId`);");
            migrationBuilder.Sql("RENAME TABLE `CashRegisters` TO `RegistriCassa`;");

            // Rename CashCounts table and columns
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `CountId` TO `Id`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `RegisterId` TO `RegistroCassaId`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `DenominationId` TO `DenominazioneMonetaId`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `Quantity` TO `Quantita`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `Total` TO `Totale`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `IsOpening` TO `IsApertura`;");
            migrationBuilder.Sql("DROP INDEX `IX_CashCounts_DenominationId` ON `CashCounts`;");
            migrationBuilder.Sql("CREATE INDEX `IX_ConteggiMoneta_DenominazioneMonetaId` ON `CashCounts` (`DenominazioneMonetaId`);");
            migrationBuilder.Sql("DROP INDEX `IX_CashCounts_RegisterId` ON `CashCounts`;");
            migrationBuilder.Sql("CREATE INDEX `IX_ConteggiMoneta_RegistroCassaId` ON `CashCounts` (`RegistroCassaId`);");
            migrationBuilder.Sql("RENAME TABLE `CashCounts` TO `ConteggiMoneta`;");

            // Rename CashIncomes table and columns
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `IncomeId` TO `Id`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `RegisterId` TO `RegistroCassaId`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `Type` TO `Tipo`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `Amount` TO `Importo`;");
            migrationBuilder.Sql("DROP INDEX `IX_CashIncomes_RegisterId` ON `CashIncomes`;");
            migrationBuilder.Sql("CREATE INDEX `IX_IncassiCassa_RegistroCassaId` ON `CashIncomes` (`RegistroCassaId`);");
            migrationBuilder.Sql("RENAME TABLE `CashIncomes` TO `IncassiCassa`;");

            // Rename CashExpenses table and columns
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `ExpenseId` TO `Id`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `RegisterId` TO `RegistroCassaId`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `Description` TO `Descrizione`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `Amount` TO `Importo`;");
            migrationBuilder.Sql("DROP INDEX `IX_CashExpenses_RegisterId` ON `CashExpenses`;");
            migrationBuilder.Sql("CREATE INDEX `IX_SpeseCassa_RegistroCassaId` ON `CashExpenses` (`RegistroCassaId`);");
            migrationBuilder.Sql("RENAME TABLE `CashExpenses` TO `SpeseCassa`;");

            // Rename Sales.RegisterId -> RegistroCassaId
            migrationBuilder.Sql("ALTER TABLE `Sales` RENAME COLUMN `RegisterId` TO `RegistroCassaId`;");
            migrationBuilder.Sql("DROP INDEX `IX_Sales_RegisterId` ON `Sales`;");
            migrationBuilder.Sql("CREATE INDEX `IX_Sales_RegistroCassaId` ON `Sales` (`RegistroCassaId`);");

            // Recreate foreign keys with new names
            migrationBuilder.AddForeignKey(
                name: "FK_ConteggiMoneta_DenominazioniMoneta_DenominazioneMonetaId",
                table: "ConteggiMoneta",
                column: "DenominazioneMonetaId",
                principalTable: "DenominazioniMoneta",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ConteggiMoneta_RegistriCassa_RegistroCassaId",
                table: "ConteggiMoneta",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_IncassiCassa_RegistriCassa_RegistroCassaId",
                table: "IncassiCassa",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SpeseCassa_RegistriCassa_RegistroCassaId",
                table: "SpeseCassa",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RegistriCassa_Utenti_UtenteId",
                table: "RegistriCassa",
                column: "UtenteId",
                principalTable: "Utenti",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_RegistriCassa_RegistroCassaId",
                table: "Sales",
                column: "RegistroCassaId",
                principalTable: "RegistriCassa",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            // Clean up stored procedure
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS SafeDropForeignKey;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Create stored procedure for safely dropping foreign keys
            migrationBuilder.Sql(@"
                DROP PROCEDURE IF EXISTS SafeDropForeignKey;
            ");

            migrationBuilder.Sql(@"
                CREATE PROCEDURE SafeDropForeignKey(
                    IN tableName VARCHAR(255),
                    IN constraintName VARCHAR(255)
                )
                BEGIN
                    DECLARE keyExists INT DEFAULT 0;

                    SELECT COUNT(*) INTO keyExists
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = tableName
                      AND CONSTRAINT_NAME = constraintName
                      AND CONSTRAINT_TYPE = 'FOREIGN KEY';

                    IF keyExists > 0 THEN
                        SET @sql = CONCAT('ALTER TABLE `', tableName, '` DROP FOREIGN KEY `', constraintName, '`');
                        PREPARE stmt FROM @sql;
                        EXECUTE stmt;
                        DEALLOCATE PREPARE stmt;
                    END IF;
                END;
            ");

            // Drop foreign keys
            migrationBuilder.Sql("CALL SafeDropForeignKey('ConteggiMoneta', 'FK_ConteggiMoneta_DenominazioniMoneta_DenominazioneMonetaId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('ConteggiMoneta', 'FK_ConteggiMoneta_RegistriCassa_RegistroCassaId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('IncassiCassa', 'FK_IncassiCassa_RegistriCassa_RegistroCassaId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('SpeseCassa', 'FK_SpeseCassa_RegistriCassa_RegistroCassaId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('RegistriCassa', 'FK_RegistriCassa_Utenti_UtenteId');");
            migrationBuilder.Sql("CALL SafeDropForeignKey('Sales', 'FK_Sales_RegistriCassa_RegistroCassaId');");

            // Reverse Sales.RegistroCassaId -> RegisterId
            migrationBuilder.Sql("DROP INDEX `IX_Sales_RegistroCassaId` ON `Sales`;");
            migrationBuilder.Sql("ALTER TABLE `Sales` RENAME COLUMN `RegistroCassaId` TO `RegisterId`;");
            migrationBuilder.Sql("CREATE INDEX `IX_Sales_RegisterId` ON `Sales` (`RegisterId`);");

            // Reverse SpeseCassa -> CashExpenses
            migrationBuilder.Sql("DROP INDEX `IX_SpeseCassa_RegistroCassaId` ON `SpeseCassa`;");
            migrationBuilder.Sql("RENAME TABLE `SpeseCassa` TO `CashExpenses`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `Id` TO `ExpenseId`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `RegistroCassaId` TO `RegisterId`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `Descrizione` TO `Description`;");
            migrationBuilder.Sql("ALTER TABLE `CashExpenses` RENAME COLUMN `Importo` TO `Amount`;");
            migrationBuilder.Sql("CREATE INDEX `IX_CashExpenses_RegisterId` ON `CashExpenses` (`RegisterId`);");

            // Reverse IncassiCassa -> CashIncomes
            migrationBuilder.Sql("DROP INDEX `IX_IncassiCassa_RegistroCassaId` ON `IncassiCassa`;");
            migrationBuilder.Sql("RENAME TABLE `IncassiCassa` TO `CashIncomes`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `Id` TO `IncomeId`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `RegistroCassaId` TO `RegisterId`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `Tipo` TO `Type`;");
            migrationBuilder.Sql("ALTER TABLE `CashIncomes` RENAME COLUMN `Importo` TO `Amount`;");
            migrationBuilder.Sql("CREATE INDEX `IX_CashIncomes_RegisterId` ON `CashIncomes` (`RegisterId`);");

            // Reverse ConteggiMoneta -> CashCounts
            migrationBuilder.Sql("DROP INDEX `IX_ConteggiMoneta_DenominazioneMonetaId` ON `ConteggiMoneta`;");
            migrationBuilder.Sql("DROP INDEX `IX_ConteggiMoneta_RegistroCassaId` ON `ConteggiMoneta`;");
            migrationBuilder.Sql("RENAME TABLE `ConteggiMoneta` TO `CashCounts`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `Id` TO `CountId`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `RegistroCassaId` TO `RegisterId`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `DenominazioneMonetaId` TO `DenominationId`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `Quantita` TO `Quantity`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `Totale` TO `Total`;");
            migrationBuilder.Sql("ALTER TABLE `CashCounts` RENAME COLUMN `IsApertura` TO `IsOpening`;");
            migrationBuilder.Sql("CREATE INDEX `IX_CashCounts_DenominationId` ON `CashCounts` (`DenominationId`);");
            migrationBuilder.Sql("CREATE INDEX `IX_CashCounts_RegisterId` ON `CashCounts` (`RegisterId`);");

            // Reverse RegistriCassa -> CashRegisters
            migrationBuilder.Sql("DROP INDEX `IX_RegistriCassa_Data` ON `RegistriCassa`;");
            migrationBuilder.Sql("DROP INDEX `IX_RegistriCassa_UtenteId` ON `RegistriCassa`;");
            migrationBuilder.Sql("RENAME TABLE `RegistriCassa` TO `CashRegisters`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Id` TO `RegisterId`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Data` TO `Date`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `TotaleApertura` TO `OpeningTotal`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `TotaleChiusura` TO `ClosingTotal`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `VenditeContanti` TO `CashSales`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `IncassoContanteTracciato` TO `CashInWhite`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `IncassiElettronici` TO `ElectronicPayments`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `IncassiFattura` TO `InvoicePayments`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `TotaleVendite` TO `TotalSales`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `SpeseFornitori` TO `SupplierExpenses`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `SpeseGiornaliere` TO `DailyExpenses`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ContanteAtteso` TO `ExpectedCash`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Differenza` TO `Difference`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ContanteNetto` TO `NetCash`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `ImportoIva` TO `VatAmount`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Note` TO `Notes`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `Stato` TO `Status`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `CreatoIl` TO `CreatedAt`;");
            migrationBuilder.Sql("ALTER TABLE `CashRegisters` RENAME COLUMN `AggiornatoIl` TO `UpdatedAt`;");
            migrationBuilder.Sql("CREATE UNIQUE INDEX `IX_CashRegisters_Date` ON `CashRegisters` (`Date`);");
            migrationBuilder.Sql("CREATE INDEX `IX_CashRegisters_UtenteId` ON `CashRegisters` (`UtenteId`);");

            // Reverse DenominazioniMoneta -> CashDenominations
            migrationBuilder.Sql("RENAME TABLE `DenominazioniMoneta` TO `CashDenominations`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `Id` TO `DenominationId`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `Valore` TO `Value`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `Tipo` TO `Type`;");
            migrationBuilder.Sql("ALTER TABLE `CashDenominations` RENAME COLUMN `OrdineVisualizzazione` TO `DisplayOrder`;");

            // Recreate original foreign keys
            migrationBuilder.AddForeignKey(
                name: "FK_CashCounts_CashDenominations_DenominationId",
                table: "CashCounts",
                column: "DenominationId",
                principalTable: "CashDenominations",
                principalColumn: "DenominationId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CashCounts_CashRegisters_RegisterId",
                table: "CashCounts",
                column: "RegisterId",
                principalTable: "CashRegisters",
                principalColumn: "RegisterId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CashIncomes_CashRegisters_RegisterId",
                table: "CashIncomes",
                column: "RegisterId",
                principalTable: "CashRegisters",
                principalColumn: "RegisterId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CashExpenses_CashRegisters_RegisterId",
                table: "CashExpenses",
                column: "RegisterId",
                principalTable: "CashRegisters",
                principalColumn: "RegisterId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_CashRegisters_Utenti_UtenteId",
                table: "CashRegisters",
                column: "UtenteId",
                principalTable: "Utenti",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Sales_CashRegisters_RegisterId",
                table: "Sales",
                column: "RegisterId",
                principalTable: "CashRegisters",
                principalColumn: "RegisterId",
                onDelete: ReferentialAction.Cascade);

            // Clean up stored procedure
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS SafeDropForeignKey;");
        }
    }
}
