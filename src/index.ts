import { BotClient } from './lib/client';
import { env } from './lib/config';
import { loadCommands, loadEvents } from './lib/loader';
import { REST, Routes, TextChannel, EmbedBuilder } from 'discord.js';
import { testDB } from './lib/db';
import { getStatusCfx } from './lib/dbStatusCfx';

const client = new BotClient();

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = client.commands.map((c) => c.data.toJSON());

  try {
    if (env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body });
      console.log(`✅ ${body.length} commandes enregistrées sur la guilde.`);
    } else {
      await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body });
      console.log(`🌍 ${body.length} commandes enregistrées globalement.`);
    }
  } catch (err) {
    console.error('❌ Erreur lors de l’enregistrement des commandes :', err);
  }
}

async function restoreCfxStatus() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return console.warn('⚠️ Aucun serveur détecté pour restaurer le statut CFX.');

    const channels = guild.channels.cache.filter((ch) => ch.isTextBased());
    for (const [, ch] of channels) {
      const saved = await getStatusCfx(guild.id, ch.id);
      if (!saved) continue;

      const channel = await guild.channels.fetch(saved.channel_id);
      if (!channel?.isTextBased()) continue;

      try {
        const msg = await (channel as TextChannel).messages.fetch(saved.message_id);
        if (!msg) continue;

        const embed = new EmbedBuilder(JSON.parse(saved.embed_json));
        await msg.edit({ embeds: [embed] });
        console.log(`♻️  Statut CFX restauré dans #${(channel as TextChannel).name}`);
      } catch (err) {
        console.warn(`⚠️ Impossible de restaurer l'embed CFX dans #${(channel as TextChannel).name}:`, err);
      }
    }
  } catch (err) {
    console.warn('⚠️ Erreur lors du rechargement automatique du statut CFX :', err);
  }
}

(async () => {
  await testDB();
  await loadCommands(client);
  await loadEvents(client);
  await client.login(env.DISCORD_TOKEN);

  client.once('ready', async () => {
    await registerCommands();
    console.log('🚀 Bot prêt deuxième vérif tu connais');

    await restoreCfxStatus();
  });
})();
