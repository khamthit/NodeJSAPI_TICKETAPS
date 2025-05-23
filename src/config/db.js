import { Pool } from "pg"; // Use ESM import for Pool
import {
  DATABASE_NAME,
  PASSWORD_DATABASE,
  PORT_DATABASE,
  URL_DATABASE,
  USER_DATABASE,
} from "./globalKey.js";

// Configure the PostgreSQL connection pool
const pool = new Pool({
  user: USER_DATABASE, // Use the imported variable
  host: URL_DATABASE, // Use the imported variable
  database: DATABASE_NAME, // Use the imported variable
  password: PASSWORD_DATABASE, // Use the imported variable
  port: PORT_DATABASE, // Use the imported variable
  max: 50, // Maximum number of clients in the pool
  idleTimeoutMillis: 500000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 50000, // How long to wait for a connection to be established
  // ssl: false, // Set to true or an object if you need SSL, e.g., { rejectUnauthorized: false } for self-signed certs
});

// Test the connection (optional, but good for immediate feedback)
// This will run when the module is imported
(async () => {
  try {
    const client = await pool.connect();
    console.log(
      `Successfully connected to PostgreSQL database: ${DATABASE_NAME} on ${URL_DATABASE}:${PORT_DATABASE}`
    );
    client.release(); // Release the client back to the pool
  } catch (err) {
    console.error("Error connecting to PostgreSQL database:", err.stack);
  }
})();

export default pool; // Export the pool for use in other modules