const ExcelJS = require('exceljs');

async function readExcel() {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Users/yalian.rodriguez/Projects/dued/duedgusto/specifiche-progetto.xlsx');
    
    console.log('=== SHEETS IN WORKBOOK ===');
    workbook.eachSheet((worksheet, sheetId) => {
      console.log(`\nSheet ${sheetId}: "${worksheet.name}"`);
      console.log(`Rows: ${worksheet.rowCount}, Columns: ${worksheet.columnCount}`);
      
      // Print first 15 rows
      console.log('\nPreview (first 15 rows):');
      let rowCount = 0;
      worksheet.eachRow((row, rowNumber) => {
        if (rowCount < 15) {
          const values = row.values ? row.values.slice(1).map(v => {
            if (v === null || v === undefined) return '';
            return v.toString().substring(0, 30);
          }).join(' | ') : '';
          console.log(`Row ${rowNumber}: ${values}`);
          rowCount++;
        }
      });
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

readExcel();
