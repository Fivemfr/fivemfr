import { pool } from './db';

export type StatusCfxEntry = {
  guild_id: string;
  channel_id: string;
  message_id: string;
  embed_json: string;
};

export async function saveStatusCfx(data: StatusCfxEntry) {
  await pool.execute(
    `INSERT INTO status_cfx (guild_id, channel_id, message_id, embed_json)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     message_id = VALUES(message_id),
     embed_json = VALUES(embed_json)`
  , [data.guild_id, data.channel_id, data.message_id, data.embed_json]);
}

export async function getStatusCfx(guild_id: string, channel_id: string) {
  const [rows] = await pool.execute(
    'SELECT * FROM status_cfx WHERE guild_id = ? AND channel_id = ? LIMIT 1',
    [guild_id, channel_id]
  );
  return (rows as any[])[0] || null;
}
