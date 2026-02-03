import { DataSource, DataSourceOptions } from 'typeorm';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 15431,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'bluepi-testing-service',
  entities: [__dirname + '/../modules/**/*.entity.{ts,js}'],
  synchronize: false,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: false,
  logging: true,
};

const dataSource = new DataSource(typeOrmConfig);
export default dataSource;
