import { exec } from 'child_process';
import path from 'path';

console.log('Sistema operativo:', process.platform);

const rmCommand = process.platform === 'win32' ? "rd /s /q node_modules" : 'rm -rf node_modules';

exec(rmCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Errore durante la rimozione: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log('node_modules eliminata con successo');
});
