import fs from 'fs';
import path from 'path';
import type { BotClient, SlashCommand } from './client';

function resolveRuntimeDir(name: 'commands' | 'events') {
  const candidates = [
    path.join(__dirname, '..', name), 
    path.join(process.cwd(), 'dist', name),
    path.join(process.cwd(), 'src', name),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error(`Impossible de localiser le dossier ${name}`);
}

function pickExtensions(dir: string): string[] {
  const hasJs = fs.readdirSync(dir).some(f => f.endsWith('.js'));
  return hasJs ? ['.js'] : ['.ts'];
}

function requireModule(absPath: string) {
  const mod = require(absPath);
  return mod?.default ?? mod;
}

export async function loadCommands(client: BotClient) {
  const commandsDir = resolveRuntimeDir('commands');

  const categories = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  for (const category of categories) {
    const folderPath = path.join(commandsDir, category);
    const exts = pickExtensions(folderPath);

    const files = fs.readdirSync(folderPath)
      .filter(f => exts.some(ext => f.endsWith(ext)));

    for (const file of files) {
      const abs = path.join(folderPath, file);
      const mod = requireModule(abs) as SlashCommand | undefined;
      if (!mod?.data?.name) continue;

      client.commands.set(mod.data.name, mod);
      console.log(`✅ Commande chargée : [${category}] ${mod.data.name}`);
    }
  }
}

export async function loadEvents(client: BotClient) {
  const eventsDir = resolveRuntimeDir('events');

  const groups = fs.readdirSync(eventsDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  for (const group of groups) {
    const folderPath = path.join(eventsDir, group);
    const exts = pickExtensions(folderPath);

    const files = fs.readdirSync(folderPath)
      .filter(f => exts.some(ext => f.endsWith(ext)));

    for (const file of files) {
      const abs = path.join(folderPath, file);
      const mod = requireModule(abs) as any;
      if (!mod?.name || !mod?.execute) continue;

      if (mod.once) client.once(mod.name, (...args) => mod.execute(client, ...args));
      else client.on(mod.name, (...args) => mod.execute(client, ...args));

      console.log(`📡 Événement chargé : ${mod.name}`);
    }
  }
}
