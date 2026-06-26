import { chmod, readFile, writeFile } from 'node:fs/promises';

async function readExisting(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT')
      return '';
    throw error;
  }
}

export async function upsertEnvironment(path, values) {
  const current = await readExisting(path);
  const replacedKeys = new Set(Object.keys(values));
  const preserved = current
    .split(/\r?\n/)
    .filter((line) => {
      const separator = line.indexOf('=');
      return separator < 0 || !replacedKeys.has(line.slice(0, separator));
    })
    .join('\n')
    .trim();
  const configured = Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n');
  const output = `${preserved ? `${preserved}\n\n` : ''}${configured}\n`;

  await writeFile(path, output, { encoding: 'utf8', mode: 0o600 });
  await chmod(path, 0o600);
}
