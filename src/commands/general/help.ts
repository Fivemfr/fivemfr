// src/commands/general/help.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../lib/client';
import { buildEmbed } from '../../lib/embed';

const cmd: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription("Affiche la liste des commandes disponibles.")
    .setDMPermission(false),

  async run({ interaction }) {
    const embed = buildEmbed({
      title: '`📘` Menu d’aide — FiveM France',
      description:
        "Voici la liste des commandes disponibles sur **.FiveM France**.",
      fields: [
        {
          name: '`🧩` **Support & Infos**',
          value:
            '• `/fivem` — Redirige vers les liens officiels\n' +
            '• `/artifact` — Liste les artefacts FiveM & RedM',
        },
        {
          name: '`⚙️` **Administration**',
          value: '• `/statuscfx` — Affiche l’état des services Cfx.re',
        },
        // {
        //   name: '`💡` **Utilitaires**',
        //   value:
        //     '• `/ping` — Vérifie la latence du bot\n' +
        //     '• `/info` — Donne des infos sur le serveur',
        // },
      ],
    });

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default cmd;
