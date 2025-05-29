import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import { UploadImageToCloud } from "../config/cloudinary.js";
import {
  SendCreate,
  SendError,
  SendError400,
  SendSuccess,
  SendErrorTokenkey,
  SendDuplicateData,
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";
import { UploadImageToServer } from "../config/cloudinary.js";
import fs from "fs";
import path from "path"; // Import the 'path' module
import { group } from "console";
import { connect } from "http2";

export default class AnnoucementController {
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

  static async saveLogsystem(username, action, details) {
    // 'async' keyword can be removed if not using 'await' inside
    return new Promise((resolve, reject) => {
      try {
        const sqlQuery =
          "Insert into system_logs (log_date_time, log_user, action_type, descriptions, log_status) values (NOW(), $1, $2, $3, 'Success')";
        const queryParams = [username, action, details];

        // Assuming 'connected' is your database connection pool/client
        connected.query(sqlQuery, queryParams, (err, result) => {
          if (err) {
            console.error("Error saving log system:", err);
            return reject(err); // IMPORTANT: Reject the promise on error
          }
          console.log("Log saved successfully for user:", username);
          return resolve(result); // IMPORTANT: Resolve the promise on success
        });
      } catch (error) {
        // This catch handles synchronous errors during query preparation
        console.error("Error in saveLogsystem (outer catch):", error);
        return reject(error); // Reject the promise for synchronous errors
      }
    });
  }

  static async showannouncement(req, res) {
    const { username, setTokenkey, searchtext = "" } = req.query;
    let { page = 1, limit = 10 } = req.query;

    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);

      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;

      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey) {
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }
      const offset = (page - 1) * limit;
      let sqlQuery = "";
      const queryParams = [];
      if (searchtext === "") {
        sqlQuery =
          "SELECT * FROM targetaudience WHERE active = 'Y' order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else {
        sqlQuery =
          "SELECT * FROM targetaudience WHERE active = 'Y' AND (code ILIKE $3 OR audience ILIKE $3) order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, `%${searchtext}%`);
      }

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500, // Internal Server Error for query failures
            EMessage.ErrorSelect || "Error fetching targetaudience",
            err
          );
        }
        if (!result.rows || result.rows.length === 0) {
          return SendError(
            res,
            404,
            EMessage.NotFound + " No targetaudience found"
          );
        }
        if (setTokenkey === tokenkey) {
          const trimmedResult = result.rows.map((row) => {
            return {
              ...row,
              tgadid: row.tgadid, // Assuming tcid does not need trimming or is not a string
              code: row.code?.trim(),
              audience: row.audience?.trim(),
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
      console.error("Error in showgroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async newtargetaudience(req, res) {
    const { username, setTokenkey } = req.query;
    const { code, audience } = req.body;

    if (!username || !setTokenkey || !code || !audience) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey) {
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokenkey !== tokenkey) {
        return SendErrorTokenkey(res, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "SELECT tgadid FROM targetaudience WHERE (code = $1 OR audience = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        audience.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendDuplicateData(
          res,
          "This data have been already created or duplicate data"
        );
      }

      const validationErrors = ValidateData({ code, audience });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "INSERT INTO targetaudience (code, audience, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING tgadid";
      const queryParams = [code.trim(), audience.trim(), username];
      // Make the callback async to use await inside
      connected.query(sqlQuery, queryParams, async (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorInsert || "Error creating Targetaudience",
            err
          );
        }
        // You might want to add error handling for savelog if it can fail in a critical way
        return SendCreate(
          res,
          200,
          "Created id :" + result.rows[0].tgadid,
          SMessage.Insert
        );
      });
      //this is save log system
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "New Targetaudience",
        `Code: ${code}, Audience: ${audience}` // Corrected "Groupname to" to "Groupname" for clarity
      );
    } catch (error) {
      console.error("Error in creategroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async deletetargetaudience(req, res) {
    const { username, setTokenkey } = req.query;
    const { tgadid } = req.body;
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey) {
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }
      if (setTokenkey !== tokenkey) {
        return SendErrorTokenkey(res, EMessage.Unauthorized, "Token key mismatch");
      }
      const sqlQuery = "update targetaudience set active = 'N' where tgadid = $1";
      connected.query(sqlQuery, [tgadid], async (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorUpdate, err);
        }
        return SendCreate(res, 200, "Deleted id :" + tgadid, SMessage.Delete);
      });
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Delete Targetaudience",
        `ID: ${tgadid}`
      );
    } catch (error) {
        console.error("Error in deletegroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

   static async updatetargetaudience(req, res) {
    const { username, setTokenkey } = req.query;
    const { tgadid, code, audience } = req.body;
    try {
      if (!username || !setTokenkey || !tgadid || !code || !audience) {
        return SendError400(res, "Missing username in query parameters");
      }
      //this is check tokenkey
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }
      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "select tgadid from targetaudience where (code =$1 and audience = $2 and active = 'Y') Order by tgadid desc limit 1";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        audience.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError400(
          res,
          "This data have been already created or duplicate data"
        );
      }

      const validationErrors = ValidateData({ code, audience });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlquery =
        "Update targetaudience SET code = $1, audience = $2, createdate = now() where tgadid = $3";
      const queryParams = [code.trim(), audience.trim(), tgadid];
      connected.query(sqlquery, queryParams, async (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error Update Targetaudience",
            err
          );
        }
        // You might want to add error handling for savelog if it can fail in a critical way
        return SendCreate(res, 200, "Update id :" + tgadid, SMessage.Update);
      });
      //this is save log
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Group Airline Updated",
        `ID: ${tgadid}, Code: ${code}, audience: ${audience}`
      );
    } catch (error) {
      console.log("Error in updategroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async showannouncementStatus(req, res) {
    const { username, setTokenkey, searchtext = "" } = req.query;
    let { page = 1, limit = 10 } = req.query;

    if (!username) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);

      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;

      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
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
          "SELECT * FROM announcementstatus WHERE active = 'Y' order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else {
        sqlQuery =
          "SELECT * FROM announcementstatus WHERE active = 'Y' AND (code ILIKE $3 OR statusname ILIKE $3) order by code asc LIMIT $1 OFFSET $2";
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
            400,
            EMessage.NotFound
          );
        }
        if (setTokenkey === tokenkey) {
          const trimmedResult = result.rows.map((row) => {
            return {
              ...row,
              astid: row.astid, // Assuming tcid does not need trimming or is not a string
              code: row.code?.trim(),
              statusname: row.statusname?.trim(),
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
          "Token key mistmatch."
        );
        }
      });
    } catch (error) {
      console.log("Error in showannouncementStatus:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async createannouncementstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { code, statusname } = req.body;

    if (!username || !setTokenkey || !code || !statusname) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "SELECT astid FROM announcementstatus WHERE (code = $1 OR statusname = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        statusname.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendDuplicateData(res, 409, EMessage.ErrorDuplicate);
      }

      const validationErrors = ValidateData({ code, statusname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "INSERT INTO announcementstatus (code, statusname, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING astid";
      const queryParams = [code.trim(), statusname.trim(), username];

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorInsert || "Error creating systemstatus",
            err
          );
        }
        return SendCreate(res, 200, "Created", SMessage.Insert);
      });
      //this is save log
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Announcement Status Saved",
        `Code: ${code}, statusname: ${statusname}`
      );
    } catch (error) {
      console.log(error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updateannouncementstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { astid, code, statusname } = req.body;

    if (!username || !setTokenkey || !astid || !code || !statusname) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const validationErrors = ValidateData({ code, statusname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "UPDATE announcementstatus SET code = $1, statusname = $2 WHERE astid = $3";
      const queryParams = [code.trim(), statusname.trim(), astid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error updating system status",
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
      //this is save log
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Annoucement Status Update",
        `ID: ${astid}, Code: ${code}, statusname: ${statusname}`
      );
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async deleteannouncementstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { astid } = req.body;

    if (!username || !setTokenkey || !astid) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendError(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const sqlQuery = "UPDATE announcementstatus SET active = 'N' WHERE astid = $1";
      const queryParams = [astid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorDelete || "Error deleting system status",
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

      //this is save log
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Announcement Status Deleted",
        `ID: ${astid}`
      );
    } catch (error) {
      console.log(error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
