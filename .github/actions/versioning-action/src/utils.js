import { exec } from '@actions/exec';

/**
 * Executes a bash command and returns its stdout.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
export async function commandExec(command) {
  let execOutput = '';

  const options = {
    listeners: {
      stdout: (data) => {
        execOutput += data.toString();
      },
    },
  };

  const exitCode = await exec(command, null, options);

  if (exitCode !== 0) {
    throw new Error(`Command "${command}" exited with code ${exitCode}.`);
  }

  return execOutput;
}
