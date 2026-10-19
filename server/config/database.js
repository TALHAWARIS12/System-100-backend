const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const pg = require('pg');

const getSequelizeInstance = () => {
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      const database = dbUrl.pathname.replace(/^\//, '') || 'neondb';
      const username = String(decodeURIComponent(dbUrl.username || 'neondb_owner'));
      const password = String(decodeURIComponent(dbUrl.password || 'npg_JhSoxnwz1pc3'));

      return new Sequelize(database, username, password, {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 5432,
        dialect: 'postgres',
        dialectModule: pg,
        logging: false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      });
    } catch (err) {
      logger.warn('DATABASE_URL parse error:', err.message);
    }
  }

  return new Sequelize(
    'neondb',
    'neondb_owner',
    'npg_JhSoxnwz1pc3',
    {
      host: 'ep-divine-shape-b4kli7em-pooler.c-6.us-east-2.aws.neon.tech',
      port: 5432,
      dialect: 'postgres',
      dialectModule: pg,
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    }
  );
};

const sequelize = getSequelizeInstance();

module.exports = { sequelize };
