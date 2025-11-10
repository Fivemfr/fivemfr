import { Events, Message } from 'discord.js';
import { awardXP, xpCooldownSeconds, xpEnabled, randomXP } from '../../lib/xp';

const lastAward = new Map<string, number>();

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(client: any, message: Message) {
    try {

      if (!xpEnabled) return;
      if (!message?.guild) return;            
      if (message.author?.bot) return;       

      const content = message.content?.trim() ?? '';
      if (content.length < 3) return;      

      const key = `${message.guild.id}:${message.author.id}`;
      const now = Date.now();
      const prev = lastAward.get(key) || 0;
      if (now - prev < xpCooldownSeconds * 1000) return;
      lastAward.set(key, now);

      const amount = randomXP();
      const res = await awardXP(message.guild, message.author.id, amount);

      if (res.leveledUp) {
        // message.channel.send({ content: `\`🎉\` <@${message.author.id}> passe **niveau ${res.level}** !` })
        //   .catch(() => {});
      }
    } catch (e) {
      console.warn('[xp] erreur messageCreate:', e);
    }
  },
};
