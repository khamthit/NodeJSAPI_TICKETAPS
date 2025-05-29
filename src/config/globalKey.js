import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT;
const URL_DATABASE = process.env.URL_DATABASE;
const USER_DATABASE = process.env.USER_DATABASE;
const PASSWORD_DATABASE = process.env.PASSWORD_DATABASE;
const DATABASE_NAME = process.env.DATABASE_NAME;
const PORT_DATABASE = process.env.PORT_DATABASE;
const SECREAT_KEY = process.env.SECREAT_KEY;
const SECREAT_KEY_REFRESH = process.env.SECREAT_KEY_REFRESH;
export {
  PORT,
  URL_DATABASE,
  USER_DATABASE,
  PASSWORD_DATABASE,
  DATABASE_NAME,
  PORT_DATABASE,
  SECREAT_KEY,
  SECREAT_KEY_REFRESH,
};
