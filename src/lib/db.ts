import mysql from 'mysql2/promise';
import { env } from './config';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  charset: 'utf8mb4_unicode_ci',
});

export async function testDB() {
  try {
    const [rows] = await pool.query('SELECT 1+1 AS result');
    console.log('✅ Base de données connectée avec succès');
    return rows;
  } catch (error) {
    console.error('❌ Erreur de connexion MySQL:', error);
    process.exit(1);
  }
}