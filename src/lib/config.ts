import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().optional(),

  EMBED_COLOR: z.string().default('#07091d'),
  EMBED_THUMBNAIL: z.string().optional(),
  EMBED_IMAGE: z.string().optional(),
  EMBED_FOOTER_TEXT: z.string().optional(),
  EMBED_FOOTER_ICON: z.string().optional(),

  DB_HOST: z.string().min(1),
  DB_PORT: z.string().default('3306'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  XP_ENABLED: z.string().optional(),
  XP_MIN: z.string().optional(),
  XP_MAX: z.string().optional(),
  XP_COOLDOWN_SECONDS: z.string().optional(),

  LEVEL_TARGET: z.string().optional(),
  LEVEL_ROLE_ID: z.string().optional(),

  XP_CHANNEL_WHITELIST: z.string().optional(),
  XP_CHANNEL_BLACKLIST: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
