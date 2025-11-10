import { Events, ActivityType } from 'discord.js';
import { testDB } from '../../lib/db';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: any) {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
    await testDB();

    const updateStatus = async () => {
      const guild = client.guilds.cache.first();
      if (!guild) return console.warn('⚠️ Aucun serveur trouvé pour le statut.');

      await guild.members.fetch();
      const memberCount = guild.memberCount;

      const statuses = [
        { text: `👥 ${memberCount} membres`, type: ActivityType.Watching },
      ];

      let index = 0;
      setInterval(() => {
        const status = statuses[index];
        client.user.setActivity(status.text, { type: status.type });
        index = (index + 1) % statuses.length;
      }, 60 * 1000);

      client.user.setActivity(statuses[0].text, { type: statuses[0].type });
    };

    await updateStatus();
  },
};
