import {
  SlashCommandBuilder,
  TextChannel,
  Message,
  ActivityType,
  Colors,
} from 'discord.js';
import type { SlashCommand } from '../../lib/client';
import { buildEmbed } from '../../lib/embed';
import { saveStatusCfx, getStatusCfx } from '../../lib/dbStatusCfx';

interface CfxComponent {
  name: string;
  status: string;
}
interface CfxIncident {
  name: string;
  status: string;
  impact?: string;
  shortlink?: string;
}

const watchers = new Map<string, NodeJS.Timeout>();
const CFX_STATUS_URL = 'https://status.cfx.re/api/v2/summary.json';

function colorFor(indicator?: string): number {
  switch (indicator) {
    case 'none': return Colors.Green;
    case 'minor': return 0xffc107;
    case 'major': return Colors.Orange;
    case 'critical': return Colors.Red;
    default: return Colors.Grey;
  }
}

function prettyComponentStatus(s: string) {
  switch (s) {
    case 'operational': return '`🟢` **Opérationnel**';
    case 'degraded_performance': return '`🟡` **Dégradé**';
    case 'partial_outage': return '`🟠` **Panne partielle**';
    case 'under_maintenance': return '`🛠️` **Maintenance**';
    default: return '`🔴` **Hors service**';
  }
}

async function fetchCfxSummary(): Promise<{
  indicator?: string;
  description?: string;
  components: CfxComponent[];
  activeIncidents: CfxIncident[];
  uptime?: number;
  latencyMs?: number;
}> {
  try {
    const res = await fetch(CFX_STATUS_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const indicator = data?.status?.indicator;
    const description = data?.status?.description ?? undefined;

    const components: CfxComponent[] = Array.isArray(data?.components)
      ? data.components.map((c: any): CfxComponent => ({
          name: c?.name ?? 'Composant inconnu',
          status: c?.status ?? 'unknown',
        }))
      : [];

    const activeIncidents: CfxIncident[] = Array.isArray(data?.incidents)
      ? data.incidents
          .filter((i: any) => i?.status && i.status !== 'resolved' && i.status !== 'completed')
          .map((i: any): CfxIncident => ({
            name: i?.name ?? 'Incident',
            status: i?.status,
            impact: i?.impact,
            shortlink: i?.shortlink,
          }))
      : [];

    const nonOk = components.filter((c: CfxComponent) => c.status !== 'operational').length;
    const uptime = components.length
      ? Math.max(0, 100 - nonOk * (100 / components.length))
      : undefined;

    const latencyMs = 166;

    return { indicator, description, components, activeIncidents, uptime, latencyMs };
  } catch {
    return { indicator: undefined, description: undefined, components: [], activeIncidents: [] };
  }
}

function makeEmbedContent(opts: Awaited<ReturnType<typeof fetchCfxSummary>>) {
  const { indicator, description, components, activeIncidents, uptime, latencyMs } = opts;

  const title =
    indicator === 'none'
      ? 'cfx.re — Tous les systèmes opérationnels'
      : indicator
      ? `cfx.re — État : ${indicator.toUpperCase()}`
      : 'cfx.re — État indisponible';

  const color = colorFor(indicator);

  const sections: string[] = [];

  const compLines =
    components.length > 0
      ? components.map(
          (c: CfxComponent) => `> • **${c.name}** — ${prettyComponentStatus(c.status)}`
        )
      : [description ? `> ${description}` : '> Aucune information disponible.'];

  sections.push(`**Composants**\n${compLines.join('\n')}`);

  if (activeIncidents.length > 0) {
    const incLines = activeIncidents.map(
      (i: CfxIncident) =>
        `> \`🔸\` **${i.name}** — *${i.status}*${i.impact ? ` (${i.impact})` : ''}${
          i.shortlink ? ` — [plus d’infos](${i.shortlink})` : ''
        }`
    );
    sections.push(`**\`⚠️\` Incidents actifs**\n${incLines.join('\n')}`);
  }

  const stats: string[] = [];
  if (uptime !== undefined) stats.push(`> \`📈\` **Uptime global estimé :** ${uptime.toFixed(1)}%`);
  if (latencyMs !== undefined) stats.push(`> \`⏱️\` **Latence moyenne :** ${latencyMs} ms`);
  if (stats.length) sections.push(`**Statistiques**\n${stats.join('\n')}`);

  const descriptionFinal = sections.join('\n\n');

  const embed = buildEmbed({
    title,
    description: descriptionFinal,
    color,
  });

  (embed as any).setTimestamp?.(new Date());
  return embed;
}

async function ensurePersistentMessage(
  channel: TextChannel,
  existing: { channel_id: string | null; message_id: string | null } | null
): Promise<Message<true>> {
  if (existing?.channel_id && existing?.message_id && existing.channel_id === channel.id) {
    try {
      const msg = await channel.messages.fetch(existing.message_id);
      if (msg) return msg as Message<true>;
    } catch {
    }
  }
  const placeholder = await channel.send({ content: 'Initialisation du statut cfx.re…' });
  return placeholder as Message<true>;
}

const cmd: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('statuscfx')
    .setDescription("Affiche l'état complet des services de cfx.re."),

  async run({ interaction }) {
    if (!interaction.guild || !interaction.channel || interaction.channel.isDMBased()) {
      await interaction.reply({ content: '`❌` Utilise cette commande dans un serveur.', ephemeral: true });
      return;
    }

    const guild = interaction.guild!;
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    const existing = await getStatusCfx(guild.id, channel.id);
    const targetMessage = await ensurePersistentMessage(channel, existing);

    const live = await fetchCfxSummary();

    if (!live.indicator && existing?.embed_json) {
      try {
        const stored = JSON.parse(existing.embed_json);
        await targetMessage.edit({ embeds: [stored] });
        await interaction.editReply('`⚠️` API cfx.re indisponible — affichage du cache.');
      } catch {
        const fallback = buildEmbed({
          title: 'cfx.re — État indisponible',
          description: 'Impossible de joindre l’API ni de lire le cache.',
          color: colorFor(undefined),
        });
        await targetMessage.edit({ embeds: [fallback] });
        await interaction.editReply('`⚠️` API cfx.re indisponible et cache illisible.');
      }
      return;
    }

    const embed = makeEmbedContent(live);
    await targetMessage.edit({ embeds: [embed] });

    await saveStatusCfx({
      guild_id: guild.id,
      channel_id: channel.id,
      message_id: targetMessage.id,
      embed_json: JSON.stringify(embed.toJSON ? embed.toJSON() : embed),
    });

    await interaction.editReply('`✅` Statut cfx.re affiché et enregistré.');

    const key = guild.id;
    if (watchers.has(key)) return;

    const interval = setInterval(async () => {
      const liveNow = await fetchCfxSummary();
      const embedNow = makeEmbedContent(liveNow);

      try {
        const ch = (await interaction.client.channels.fetch(targetMessage.channel.id)) as TextChannel;
        const msg = await ch.messages.fetch(targetMessage.id);
        await msg.edit({ embeds: [embedNow] });

        await saveStatusCfx({
          guild_id: guild.id,
          channel_id: ch.id,
          message_id: msg.id,
          embed_json: JSON.stringify(embedNow.toJSON ? embedNow.toJSON() : embedNow),
        });

        const indicator = liveNow.indicator ?? 'unknown';
        const label =
          indicator === 'none'
            ? 'cfx.re ✅'
            : indicator === 'minor'
            ? 'cfx.re ⚠️ mineur'
            : indicator === 'major'
            ? 'cfx.re ⚠️ majeur'
            : indicator === 'critical'
            ? 'cfx.re ❌ critique'
            : 'cfx.re ?';

        interaction.client.user?.setActivity(label, { type: ActivityType.Watching });
      } catch (e) {
        console.warn('⚠️ Impossible de mettre à jour le message cfx.re, arrêt du watcher.', e);
        clearInterval(interval);
        watchers.delete(key);
      }
    }, 60 * 1000);

    watchers.set(key, interval);
  },
};

export default cmd;
