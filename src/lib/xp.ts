import { env } from './config';
import { pool } from './db';
import type { Guild, GuildMember } from 'discord.js';

const XP_ENABLED = String(env.XP_ENABLED ?? 'true') === 'true';
const XP_MIN = Number(env.XP_MIN ?? 15);
const XP_MAX = Number(env.XP_MAX ?? 25);
const COOLDOWN = Number(env.XP_COOLDOWN_SECONDS ?? 60);

const LEVEL_TARGET = Number(env.LEVEL_TARGET ?? 20);
const LEVEL_ROLE_ID = String(env.LEVEL_ROLE_ID ?? '').trim() || undefined;

export function xpToNext(level: number): number {
  return 100 + 50 * level + 25 * level * level;
}

export function levelForTotalXP(totalXP: number): { level: number; intoLevelXP: number; toNext: number } {
  let lvl = 0;
  let remaining = totalXP;

  for (let guard = 0; guard < 1000; guard++) {
    const need = xpToNext(lvl);
    if (remaining < need) {
      return { level: lvl, intoLevelXP: remaining, toNext: need };
    }
    remaining -= need;
    lvl++;
  }
  return { level: 1000, intoLevelXP: 0, toNext: xpToNext(1000) };
}

export async function getUserXP(guildId: string, userId: string) {
  const [rows] = await pool.execute(
    'SELECT xp, level FROM user_xp WHERE guild_id = ? AND user_id = ? LIMIT 1',
    [guildId, userId]
  );
  const r = (rows as any[])[0];
  if (!r) return { xp: 0, level: 0 };
  return { xp: Number(r.xp || 0), level: Number(r.level || 0) };
}

export async function setUserXP(guildId: string, userId: string, xp: number, level: number) {
  await pool.execute(
    `INSERT INTO user_xp (guild_id, user_id, xp, level)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE xp = VALUES(xp), level = VALUES(level)`,
    [guildId, userId, xp, level]
  );
}

export function randomXP(): number {
  const min = Math.max(0, XP_MIN | 0);
  const max = Math.max(min, XP_MAX | 0);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const xpCooldownSeconds = COOLDOWN;
export const xpEnabled = XP_ENABLED;

export async function awardXP(guild: Guild, userId: string, amount: number) {
  const { xp, level } = await getUserXP(guild.id, userId);
  const newXP = Math.max(0, xp + amount);
  const calc = levelForTotalXP(newXP);

  if (calc.level > level) {
    await setUserXP(guild.id, userId, newXP, calc.level);
    if (LEVEL_ROLE_ID && calc.level >= LEVEL_TARGET) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && !member.roles.cache.has(LEVEL_ROLE_ID)) {
          await member.roles.add(LEVEL_ROLE_ID, `Niveau ${calc.level} atteint (système XP)`);
        }
      } catch (e) {
        console.warn(`[xp] Impossible d'ajouter le rôle ${LEVEL_ROLE_ID} à ${userId} :`, e);
      }
    }
    return { xp: newXP, level: calc.level, leveledUp: true, into: calc.intoLevelXP, toNext: calc.toNext };
  } else {
    await setUserXP(guild.id, userId, newXP, level);
    return { xp: newXP, level, leveledUp: false, into: calc.intoLevelXP, toNext: calc.toNext };
  }
}

export async function forceSetLevel(guildId: string, userId: string, targetLevel: number) {
  let total = 0;
  for (let l = 0; l < targetLevel; l++) total += xpToNext(l);
  await setUserXP(guildId, userId, total, targetLevel);
  return total;
}
