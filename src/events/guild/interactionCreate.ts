import { Events, InteractionType } from 'discord.js';
import type { BotClient } from '../../lib/client';

export default {
  name: Events.InteractionCreate,
  async execute(client: BotClient, interaction: any) {
    try {
      if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        await cmd.run({ client, interaction });
        return;
      }

  if (interaction.isButton()) {
    const id: string = interaction.customId;
    if (id.startsWith('artifact:pick:')) {
      const mod = await import('../../commands/support/artifact');
    }
  }

    } catch (e) {
      console.error('interaction error:', e);
      const canReply = !interaction.replied && !interaction.deferred;
      if (canReply) {
        await interaction.reply({ content: '❌ Erreur lors du traitement.', flags: 64 }).catch(() => {});
      }
    }
  },
};
