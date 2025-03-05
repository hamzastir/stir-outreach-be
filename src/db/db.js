import knex from 'knex';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

const knexConfig = {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      port: process.env.PG_PORT,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000
    },
};

export const db = knex(knexConfig);