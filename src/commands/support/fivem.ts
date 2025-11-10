import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import type { SlashCommand } from '../../lib/client';
import { buildEmbed } from '../../lib/embed';

const cmd: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('fivem')
    .setDescription('Infos support officiel FiveM/RedM/Cfx.re')
    .setDMPermission(false),

  async run({ interaction }) {
    if (!interaction.guild || !interaction.channel || interaction.channel.isDMBased()) {
      await interaction.reply({
        content: '`❌` Utilise cette commande dans un serveur.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const mention = `<@${interaction.user.id}>`;

    const embed = buildEmbed({
      title: 'Support officiel FiveM / RedM / Cfx.re',
      description:
        "Pour tout **problème** ou **question** liés à **FiveM / RedM / Cfx.re**, merci d’utiliser **leurs canaux officiels** :\n\n" +
        "`👉` https://forum.fivem.net/\n" +
        "`👉` https://discord.gg/fivem",
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Forum FiveM')
        .setURL('https://forum.fivem.net/'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Discord FiveM')
        .setURL('https://discord.gg/fivem')
    );

    await interaction.reply({
      content: `${mention}`,
      embeds: [embed],
      components: [buttons],
    });
  },
};

export default cmd;
