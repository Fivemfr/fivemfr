import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder;

export type SlashCommand = {
  data: CommandBuilder;
  run: (ctx: { client: BotClient; interaction: ChatInputCommandInteraction }) => Promise<any>;
};

export class BotClient extends Client {
  public commands = new Collection<string, SlashCommand>();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });
  }
}
