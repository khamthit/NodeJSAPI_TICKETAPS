import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import { SendCreate, SendError, SendError400, SendSuccess } from "../service/response.js";
import { ValidateData } from "../service/validate.js";
export default class PriorityController {
  static async fetchTokenKeyForUser(username) {
    return new Promise((resolve, reject) => {
      if (!username) {
        console.log("No emailorphone provided");
        return resolve(null);
      }
      const sqlQuery = `select "tokenKey" from vm_useractive where username = $1`;
      connected.query(sqlQuery, [username], (err, result) => {
        if (err) {
          //   console.log("Database error fetching tokenkey:", err);
          return reject(new Error("Database query failed while fetching token key."));
        }
        if (!result || !result.rows || result.rows.length === 0) {
          console.log("No tokenkey found for:", username);
          return resolve(null);
        }
        // console.log("Tokenkey found:", result.rows[0].tokenKey);
        resolve(result.rows[0].tokenKey);
      });
    });
  }
  static async showPriority(req, res) {
    const {
      username,
      setTokkenkey,
      searchtext = ""
    } = req.query;
    let {
      page = 1,
      limit = 10
    } = req.query;
    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      const tokenkey = await PriorityController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key not found or invalid for user");
      }
      //this is check tokenkey
      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key not found or invalid for user");
      }
      const offset = (page - 1) * limit;
      const sqlQuery = "SELECT * FROM priority WHERE (code LIKE $1 OR priority LIKE $1) ORDER BY ptid LIMIT $2 OFFSET $3";
      const values = [`%${searchtext}%`, limit, offset];
      connected.query(sqlQuery, values, (err, result) => {
        if (err) {
          console.error("Error executing query:", err);
          return SendError(res, 500, EMessage.InternalServerError);
        }
        const totalCountQuery = "SELECT COUNT(*) FROM priority WHERE active = 'Y' AND (code LIKE $1 OR priority ILIKE $1)";
        connected.query(totalCountQuery, [`%${searchtext}%`], (errCount, resultCount) => {
          if (errCount) {
            console.error("Error executing count query:", errCount);
            return SendError(res, 500, EMessage.InternalServerError);
          }
          const totalCount = parseInt(resultCount.rows[0].count, 10);
          const totalPages = Math.ceil(totalCount / limit);
          if (result.rows.length === 0) {
            return SendError(res, 404, EMessage.NotFound);
          } else {
            return SendSuccess(res, SMessage.SelectAll, result.rows);
          }
        });
      });
    } catch (error) {
      console.error("Error in showTicketCategory:", error);
      return SendError(res, 500, EMessage.InternalServerError);
    }
  }
  static async createPriority(req, res) {
    const {
      username,
      setTokkenkey
    } = req.query;
    const {
      code,
      priority
    } = req.body;
    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await PriorityController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key not found or invalid for user");
      }
      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery = "SELECT ptid FROM priority WHERE (code = $1 OR priority = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [code.trim(), priority.trim()]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(res, 409, "This data have been already created or duplicate data");
      }
      const validationErrors = ValidateData({
        code,
        priority
      });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }
      const sqlQuery = "INSERT INTO priority (code, priority, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING ptid";
      const queryParams = [code.trim(), priority.trim(), username];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorInsert || "Error creating ticket category", err);
        }
        return SendCreate(res, 200, "Created", queryParams);
      });
    } catch (error) {
      console.error("Error in createPriority:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async updatePriority(req, res) {
    const {
      username,
      setTokkenkey
    } = req.query;
    const {
      ptid,
      code,
      priority
    } = req.body;
    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await PriorityController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key not found or invalid for user");
      }
      //this is check tokenkey
      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }
      const validationErrors = ValidateData({
        code,
        priority
      });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery = "SELECT ptid FROM priority WHERE (code = $1 AND priority = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [code.trim(), priority.trim()]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(res, 409, "This data have been already created or duplicate data");
      }
      //this is update data
      const sqlQuery = "UPDATE priority SET code = $1, priority = $2 WHERE ptid = $3";
      const queryParams = [code.trim(), priority.trim(), ptid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorUpdate || "Error updating ticket category", err);
        }
        return SendCreate(res, 200, "Updated", queryParams);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async deletePriority(req, res) {
    const {
      username,
      setTokkenkey
    } = req.query;
    const {
      ptid
    } = req.body;
    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await PriorityController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key not found or invalid for user");
      }
      //this is check tokenkey
      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery = "SELECT ptid FROM priority WHERE ptid = $1 And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [ptid]);
      if (existenceResult.rows.length === 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(res, 404, EMessage.NotFound);
      }
      //this is update data
      const sqlQuery = "UPDATE priority SET active = 'N' WHERE ptid = $1 RETURNING ptid";
      const queryParams = [ptid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorDelete || "Error deleting ticket category", err);
        }
        return SendCreate(res, 200, "Deleted", queryParams);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}