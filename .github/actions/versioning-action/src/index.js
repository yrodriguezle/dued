import * as core from '@actions/core';
import fs from 'fs/promises';
import { commandExec } from './utils.js';

const BUMP_TYPES = ['patch', 'minor', 'major'];

const FILES = {
  rootPackage: './package.json',
  frontendPackage: './duedgusto/package.json',
  backendCsproj: './backend/duedgusto.csproj',
};

async function updateCsproj(filePath, version) {
  const content = await fs.readFile(filePath, 'utf8');
  const updated = content.replace(/<Version>.*<\/Version>/, `<Version>${version}</Version>`);
  await fs.writeFile(filePath, updated, 'utf8');
  core.info(`Updated ${filePath} to ${version}`);
}

async function run() {
  try {
    const bumpType = core.getInput('bump-type', { required: true });

    if (!BUMP_TYPES.includes(bumpType)) {
      core.setFailed(`Invalid bump-type "${bumpType}". Must be one of: ${BUMP_TYPES.join(', ')}`);
      return;
    }

    // Bump root package.json
    await commandExec(`npm version ${bumpType} --no-git-tag-version`);

    // Bump duedgusto/package.json
    await commandExec(`npm version ${bumpType} --no-git-tag-version --prefix ./duedgusto`);

    // Sync package-lock.json files after version bump
    await commandExec('npm install --package-lock-only');
    await commandExec('npm install --package-lock-only --prefix ./duedgusto');

    // Read new version from root package.json
    const pkg = JSON.parse(await fs.readFile(FILES.rootPackage, 'utf8'));
    const newVersion = pkg.version;
    core.info(`New version: ${newVersion}`);

    // Update csproj
    await updateCsproj(FILES.backendCsproj, newVersion);

    core.setOutput('version', newVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
