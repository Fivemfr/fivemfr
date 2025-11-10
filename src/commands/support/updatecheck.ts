import {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { SlashCommand } from '../../lib/client';
import { buildEmbed } from '../../lib/embed';

const WIN_FALLBACK = 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/';
const LIN_FALLBACK = 'https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/';

const JG_URLS = [
  'https://artifacts.jgscripts.com/',
  'https://artifacts.jgscripts.com/api',
  'https://artifacts.jgscripts.com/data.json',
  'https://artifacts.jgscripts.com/json',
];

type ArtifactInfo = {
  stable?: number;
  windows?: string;
  linux?: string;
};

async function fetchLatestArtifact(): Promise<ArtifactInfo> {
  for (const url of JG_URLS) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json, text/html;q=0.8' } });
      if (!res.ok) continue;

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data: any = await res.json();
        const stable =
          Number(data?.latestStableArtifact ?? data?.stable ?? data?.latest ?? data?.recommended) || undefined;
        const windows =
          data?.windows?.link ?? data?.windows ?? data?.win ?? data?.winUrl ?? WIN_FALLBACK;
        const linux =
          data?.linux?.link ?? data?.linux ?? data?.lin ?? data?.linuxUrl ?? LIN_FALLBACK;
        if (stable) return { stable, windows, linux };
      } else {
        const html = await res.text();
        const m = html.match(/Latest\s+Stable\s+Artifact[:\s]+(\d{4,6})/i) || html.match(/\b(\d{5,6})\b/);
        const stable = m ? Number(m[1]) : undefined;
        if (stable) return { stable, windows: WIN_FALLBACK, linux: LIN_FALLBACK };
      }
    } catch {
      continue;
    }
  }

  try {
    const res = await fetch(WIN_FALLBACK, { headers: { Accept: 'text/html' } });
    const html = await res.text();
    const matches = [...html.matchAll(/href="\/artifacts\/[^"]+\/(\d{4,6})\/"/g)];
    const builds = matches.map((m) => Number(m[1])).filter((n) => !Number.isNaN(n));
    const stable = builds.length ? Math.max(...builds) : undefined;
    if (stable) return { stable, windows: WIN_FALLBACK, linux: LIN_FALLBACK };
  } catch {
  }

  return { windows: WIN_FALLBACK, linux: LIN_FALLBACK };
}

const cmd: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('updatecheck')
    .setDescription('Vérifie si ton serveur est à jour avec le dernier artifact stable.')
    .addIntegerOption((opt) =>
      opt
        .setName('version')
        .setDescription('Ta version actuelle (ex: 6932). Laisse vide pour juste voir la dernière.')
        .setRequired(false)
    )
    .setDMPermission(false),

  async run({ interaction }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userVersion = interaction.options.getInteger('version') ?? null;
    const latest = await fetchLatestArtifact();

    if (!latest.stable) {
      await interaction.editReply({
        embeds: [
          buildEmbed({
            title: 'Vérification de mise à jour',
            description: "Impossible de récupérer le dernier artifact stable pour le moment.\nRéessaie plus tard.",
          }),
        ],
      });
      return;
    }

    const lines: string[] = [];
    lines.push(`\`🧩\` **Dernier stable :** ${latest.stable}`);

    if (userVersion) {
      lines.push(`\`📦\` **Ta version actuelle :** ${userVersion}`);
      if (userVersion >= latest.stable) {
        lines.push('`✅` **Ton serveur est à jour.**');
      } else {
        lines.push('`⚠️` **Une mise à jour est disponible !**');
      }
    } else {
      lines.push('`ℹ️` Fournis une version pour comparer (`/updatecheck version:XXXX`).');
    }

    const embed = buildEmbed({
      title: 'FiveM Artifact',
      description: lines.join('\n'),
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Windows').setURL(latest.windows || WIN_FALLBACK),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Linux').setURL(latest.linux || LIN_FALLBACK)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};

export default cmd;
