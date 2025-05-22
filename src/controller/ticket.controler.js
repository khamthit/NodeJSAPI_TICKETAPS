import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import {
  SendCreate,
  SendError,
  SendError400,
  SendSuccess,
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";

export default class TicketController {
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
          return reject(
            new Error("Database query failed while fetching token key.")
          );
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

  static async showTicketCategory(req, res) {
    const { username, setTokkenkey, searchtext = "" } = req.query;
    let { page = 1, limit = 10 } = req.query;

    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);

      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;

      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      const offset = (page - 1) * limit;
      let sqlQuery = "";
      const queryParams = [];

      if (searchtext === "") {
        sqlQuery =
          "SELECT * FROM ticketcategory WHERE active = 'Y' order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else {
        sqlQuery =
          "SELECT * FROM ticketcategory WHERE active = 'Y' AND (code ILIKE $3 OR categoryname ILIKE $3) order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, `%${searchtext}%`);
      }

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500, // Internal Server Error for query failures
            EMessage.ErrorSelect || "Error fetching ticket categories",
            err
          );
        }
        if (!result.rows || result.rows.length === 0) {
          return SendError(
            res,
            404,
            EMessage.NotFound + " No ticket categories found"
          );
        }
        if (setTokkenkey === tokenkey) {
          const trimmedResult = result.rows.map((row) => {
            return {
              ...row,
              tcid: row.tcid, // Assuming tcid does not need trimming or is not a string
              code: row.code?.trim(),
              categoryname: row.categoryname?.trim(),
              createdate: row.createdate, // Assuming createdate does not need trimming
              createby: row.createby, // Assuming createby does not need trimming
            };
          });
          return SendSuccess(res, SMessage.SelectAll, trimmedResult);
        } else {
          return SendError(
            res,
            401,
            EMessage.Unauthorized,
            "Token key mismatch"
          );
        }
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async createTicketCategory(req, res) {
    const { username, setTokkenkey } = req.query;
    const { code, categoryname } = req.body;

    if (!username || !setTokkenkey || !code || !categoryname) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "SELECT tcid FROM ticketcategory WHERE (code = $1 OR categoryname = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        categoryname.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(
          res,
          409,
          "This data have been already created or duplicate data"
        );
      }

      const validationErrors = ValidateData({ code, categoryname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "INSERT INTO ticketcategory (code, categoryname, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING tcid";
      const queryParams = [code.trim(), categoryname.trim(), username];

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorInsert || "Error creating ticket category",
            err
          );
        }
        return SendCreate(res, 200, "Created", SMessage.Insert);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updateTicketCategory(req, res) {
    const { username, setTokkenkey } = req.query;
    const { tcid, code, categoryname } = req.body;

    if (!username || !setTokkenkey || !tcid || !code || !categoryname) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const validationErrors = ValidateData({ code, categoryname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "UPDATE ticketcategory SET code = $1, categoryname = $2 WHERE tcid = $3";
      const queryParams = [code.trim(), categoryname.trim(), tcid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error updating ticket category",
            err
          );
        }
        return SendCreate(
          res,
          200,
          "Updated",
          SMessage.Update || "Update Success"
        );
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async deleteTicketCategory(req, res) {
    const { username, setTokkenkey } = req.query;
    const { tcid } = req.body;

    if (!username || !setTokkenkey || !tcid) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokkenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const sqlQuery = "UPDATE ticketcategory SET active = 'N' WHERE tcid = $1";
      const queryParams = [tcid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorDelete || "Error deleting ticket category",
            err
          );
        }
        return SendCreate(
          res,
          200,
          "Deleted",
          SMessage.Delete || "Delete Success"
        );
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
