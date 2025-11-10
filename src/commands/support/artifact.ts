import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  APIEmbed,
} from 'discord.js';
import type { SlashCommand } from '../../lib/client';
import { buildEmbed } from '../../lib/embed';

type BrokenItem = { range: string; reason?: string };
type ArtifactData = {
  stable?: string;
  broken: BrokenItem[];
  windows?: string;
  linux?: string;
};

const CANDIDATE_URLS = [
  'https://artifacts.jgscripts.com/api/data.json',
  'https://artifacts.jgscripts.com/data.json',
  'https://artifacts.jgscripts.com/api',
  'https://artifacts.jgscripts.com/json',
  'https://artifacts.jgscripts.com/.well-known/data.json',
  'https://artifacts.jgscripts.com/',
];

const WIN_FALLBACK = 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/';
const LIN_FALLBACK = 'https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/';
const CACHE_TTL = 60_000;

let CACHE: { at: number; data: ArtifactData } | null = null;

const ua = { 'User-Agent': 'FiveMFranceBot/1.0 (+https://fivemfrance.example)' };

// utils
const normDash = (s: string) => s.replace(/[–—]/g, '-').replace(/\s+/g, '');
function pushUnique<T>(arr: T[], item: T, key: (x: T) => string) {
  const id = key(item);
  if (!arr.some((e) => key(e) === id)) arr.push(item);
}

function parseJsonPayload(data: any): ArtifactData {
  const get = (obj: any, keys: string[], d?: any) => {
    for (const k of keys) if (obj && obj[k] != null) return obj[k];
    return d;
  };

  const stable = String(
    get(data, ['latestStableArtifact', 'stable', 'latest', 'recommended', 'latestStable'], '')
  ).trim() || undefined;

  let brokenRaw: any = get(
    data,
    ['brokenArtifacts', 'broken', 'issues', 'bad', 'notRecommended', 'doNotUse'],
    []
  );

  if (Array.isArray(brokenRaw)) {
  } else if (brokenRaw && typeof brokenRaw === 'object') {
    brokenRaw = Object.entries(brokenRaw).map(([range, reason]) => ({ range, reason }));
  } else {
    brokenRaw = [];
  }

  const broken: BrokenItem[] = [];
  for (const b of brokenRaw) {
    const range = normDash(String(b?.range ?? b?.span ?? b?.id ?? b?.build ?? '').trim());
    const reason = (b?.reason ?? b?.why ?? b?.desc ?? b?.description ?? '').toString().trim() || undefined;
    if (range) pushUnique(broken, { range, reason }, (x) => x.range.toLowerCase());
  }

  const winObj = get(data, ['windows'], undefined);
  const linObj = get(data, ['linux'], undefined);

  const windows =
    (typeof winObj === 'object' ? winObj?.link : winObj) ??
    get(data, ['win', 'winUrl', 'windowsUrl', 'downloadWindows']) ??
    WIN_FALLBACK;

  const linux =
    (typeof linObj === 'object' ? linObj?.link : linObj) ??
    get(data, ['lin', 'linuxUrl', 'downloadLinux']) ??
    LIN_FALLBACK;

  return { stable, broken, windows, linux };
}

function parseHtmlPayload(html: string): ArtifactData {
  let stable: string | undefined;
  const mStableBacktick = html.match(
    /Latest.*?artifact.*?no\s+reported\s+issues[^`]*`(\d{4,6})/i
  );
  if (mStableBacktick) {
    stable = mStableBacktick[1];
  } else {
    const mLatestBlock = html.split(/Latest\*?\s+artifact/i)[1] || html;
    const nums = [...mLatestBlock.matchAll(/\b(\d{4,6})\b/g)].map((m) => Number(m[1]));
    if (nums.length) stable = String(Math.max(...nums));
  }

  const broken: BrokenItem[] = [];
  const parts = html.split(/Artifacts\s+with\s+reported\s+issues:/i);
  if (parts[1]) {
    const block = parts[1];
    const rgxItem = /`([^`]+?)`/g;
    let m: RegExpExecArray | null;
    while ((m = rgxItem.exec(block))) {
      const content = m[1].trim();
      const idMatch = content.match(
        /^(\d{4,6}(?:\s*[–-]\s*\d{4,6})?)(?:\s+(.+))?$/i
      );
      if (idMatch) {
        const range = normDash(idMatch[1]);
        const reason = (idMatch[2] || '').trim() || undefined;
        if (range) pushUnique(broken, { range, reason }, (x) => x.range.toLowerCase());
      }
    }
    if (broken.length === 0) {
      const rgxRange = /([0-9]{4,6}\s*[–-]\s*[0-9]{4,6})(?:[^\n<]*)(?:<br\s*\/?>|\n|\r\n)?([^<\n\r]{0,200})?/gi;
      while ((m = rgxRange.exec(block))) {
        const range = normDash(m[1]);
        const reason = (m[2] || '').trim() || undefined;
        if (range) pushUnique(broken, { range, reason }, (x) => x.range.toLowerCase());
      }
    }
  }

  const lower = html.toLowerCase();
  const win =
    (lower.match(/href="([^"]*windows[^"]*)"/) ||
      lower.match(/href='([^']*windows[^']*)'/) ||
      [])[1] || WIN_FALLBACK;
  const lin =
    (lower.match(/href="([^"]*linux[^"]*)"/) ||
      lower.match(/href='([^']*linux[^']*)'/) ||
      [])[1] || LIN_FALLBACK;

  return { stable, broken, windows: win, linux: lin };
}

async function fetchArtifacts(): Promise<ArtifactData> {
  if (CACHE && Date.now() - CACHE.at < CACHE_TTL) return CACHE.data;

  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json, text/html;q=0.8', ...ua },
      });
      if (!res.ok) {
        console.warn(`[artifact] ${url} -> HTTP ${res.status}`);
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        const parsed = parseJsonPayload(json);
        CACHE = { at: Date.now(), data: parsed };
        console.log(`[artifact] using JSON endpoint: ${url}`);
        return parsed;
      } else {
        const html = await res.text();
        const parsed = parseHtmlPayload(html);
        CACHE = { at: Date.now(), data: parsed };
        console.log(`[artifact] using HTML endpoint: ${url}`);
        return parsed;
      }
    } catch (e) {
      console.warn(`[artifact] fetch failed for ${url}:`, e);
      continue;
    }
  }

  throw new Error('No valid endpoint for artifacts.jgscripts.com');
}

function makeEmbed(data: ArtifactData) {
  const fields: APIEmbed['fields'] = [];

  if (data.stable) {
    fields.push({ name: 'Stable (dernier build)', value: `**${data.stable}**`, inline: true });
  }

  if (data.broken && data.broken.length) {
    const sorted = [...data.broken].sort((a, b) => {
      const aStart = Number(a.range.split('-')[0]);
      const bStart = Number(b.range.split('-')[0]);
      return bStart - aStart;
    });

    const max = 12;
    const shown = sorted.slice(0, max);
    const extra = sorted.length - shown.length;

    const list = shown
      .map((b) => `\`❌\` **${b.range}**${b.reason ? `\n${b.reason}` : ''}`)
      .join('\n\n')
      .slice(0, 1024);

    fields.push({
      name: extra > 0 ? `Artifacts à éviter (${sorted.length}, affichés ${shown.length})` : 'Artifacts à éviter',
      value: extra > 0 ? `${list}\n\n*…et ${extra} de plus sur le site.*` : list,
      inline: false,
    });
  }

  return buildEmbed({
    title: 'Artefacts cfx.re',
    description: '**Télécharge le dernier artefact ci-dessous 👇**',
    fields,
  });
}

function makeButtons(data: ArtifactData) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Windows').setURL(data.windows || WIN_FALLBACK),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Linux').setURL(data.linux || LIN_FALLBACK),
  );
}

const cmd: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('artifact')
    .setDescription("Affiche l'artefact stable et les builds à éviter.")
    .setDMPermission(false),

  async run({ interaction }) {
    if (!interaction.guild || !interaction.channel || interaction.channel.isDMBased()) {
      await interaction.reply({ content: '`❌` Utilise cette commande dans un serveur.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    try {
      const data = await fetchArtifacts();
      await interaction.editReply({
        embeds: [makeEmbed(data)],
        components: [makeButtons(data)],
      });
    } catch (e) {
      console.error('[artifact] fatal:', e);
      await interaction.editReply({
        embeds: [
          buildEmbed({
            title: 'Artefacts cfx.re',
            description: 'Impossible de récupérer les données pour le moment.',
          }),
        ],
      });
    }
  },
};

export default cmd;
