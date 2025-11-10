import { APIEmbed, EmbedBuilder } from 'discord.js';
import { env } from './config';

export type EmbedInput = {
  title?: string;
  description?: string;
  fields?: APIEmbed['fields'];
  image?: string;
  thumbnail?: string;
  color?: number;
  footerText?: string;
  footerIcon?: string;
};

const parseHex = (hex?: string) => (hex ? parseInt(hex.replace('#', ''), 16) : undefined);

export function buildEmbed(opts: EmbedInput = {}) {
  const color = opts.color ?? parseHex(env.EMBED_COLOR) ?? 0x0091ff;

  const embed = new EmbedBuilder().setColor(color).setTimestamp();

  if (opts.title) embed.setTitle(opts.title);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.thumbnail ?? env.EMBED_THUMBNAIL) embed.setThumbnail(opts.thumbnail ?? env.EMBED_THUMBNAIL!);
  if (opts.image ?? env.EMBED_IMAGE) embed.setImage(opts.image ?? env.EMBED_IMAGE!);
  if (env.EMBED_FOOTER_TEXT)
    embed.setFooter({
      text: opts.footerText ?? env.EMBED_FOOTER_TEXT!,
      iconURL: opts.footerIcon ?? env.EMBED_FOOTER_ICON,
    });
  if (opts.fields) embed.setFields(opts.fields);

  return embed;
}
