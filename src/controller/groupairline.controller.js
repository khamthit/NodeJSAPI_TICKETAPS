import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import { UploadImageToCloud } from "../config/cloudinary.js";
import {
  SendCreate,
  SendError,
  SendError400,
  SendSuccess,
  SendDuplicateData,
  SendErrorTokenkey
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";
import { UploadImageToServer } from "../config/cloudinary.js";
import fs from "fs";
import path from "path"; // Import the 'path' module
import { group } from "console";
import { connect } from "http2";

export default class GroupAirlineController {
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

  static async showgroupline(req, res) {
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

      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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

      const offset = (page - 1) * limit;
      let sqlQuery = "";
      const queryParams = [];

      if (searchtext === "") {
        sqlQuery =
          "SELECT * FROM groupairline WHERE active = 'Y' order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else {
        sqlQuery =
          "SELECT * FROM groupairline WHERE active = 'Y' AND (code ILIKE $3 OR groupname ILIKE $3) order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, `%${searchtext}%`);
      }

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500, // Internal Server Error for query failures
            EMessage.ErrorSelect || "Error fetching ticket group airline",
            err
          );
        }
        if (!result.rows || result.rows.length === 0) {
          return SendError(
            res,
            404,
            EMessage.NotFound + " No ticket group airline found"
          );
        }
        if (setTokenkey === tokenkey) {
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
      console.error("Error in showgroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async creategroupline(req, res) {
    const { username, setTokenkey } = req.query;
    const { code, groupname } = req.body;

    if (!username || !setTokenkey || !code || !groupname) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "SELECT galid FROM groupairline WHERE (code = $1 OR groupname = $2) And active = 'Y'";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        groupname.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(
          res,
          409,
          "This data have been already created or duplicate data"
        );
      }

      const validationErrors = ValidateData({ code, groupname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "INSERT INTO groupairline (code, groupname, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING galid";
      const queryParams = [code.trim(), groupname.trim(), username];
      // Make the callback async to use await inside
      connected.query(sqlQuery, queryParams, async (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorInsert || "Error creating group airline",
            err
          );
        }
        // You might want to add error handling for savelog if it can fail in a critical way
        return SendCreate(
          res,
          200,
          "Created id :" + result.rows[0].galid,
          SMessage.Insert
        );
      });
      //this is save log system
      const savelog = await GroupAirlineController.saveLogsystem(
        username,
        "New Group Airline Created",
        `Code: ${code}, Groupname: ${groupname}` // Corrected "Groupname to" to "Groupname" for clarity
      );
    } catch (error) {
      console.error("Error in creategroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async deletegroupline(req, res) {
    const { username, setTokenkey } = req.query;
    const { galid } = req.body;
    try {
      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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
      const sqlQuery = "update groupairline set active = 'N' where galid = $1";
      connected.query(sqlQuery, [galid], async (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorUpdate, err);
        }
        return SendCreate(res, 200, "Deleted id :" + galid, SMessage.Delete);
      });
      const savelog = await GroupAirlineController.saveLogsystem(
        username,
        "Group Airline Deleted",
        `ID: ${galid}`
      );
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async updategroupline(req, res) {
    const { username, setTokenkey } = req.query;
    const { galid, code, groupname } = req.body;
    try {
      if (!username || !setTokenkey || !galid || !code || !groupname) {
        return SendError400(res, "Missing username in query parameters");
      }
      //this is check tokenkey
      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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
        "select galid from groupairline where (code =$1 and groupname = $2 and active = 'Y') Order by galid desc limit 1";
      const existenceResult = await client.query(checkExistenceQuery, [
        code.trim(),
        groupname.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError400(
          res,
          "This data have been already created or duplicate data"
        );
      }

      const validationErrors = ValidateData({ code, groupname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlquery =
        "Update groupairline SET code = $1, groupname = $2, createdate = now() where galid = $3";
      const queryParams = [code.trim(), groupname.trim(), galid];
      connected.query(sqlquery, queryParams, async (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error creating group airline",
            err
          );
        }
        // You might want to add error handling for savelog if it can fail in a critical way
        return SendCreate(res, 200, "Update id :" + galid, SMessage.Insert);
      });
      //this is save log
      const savelog = await GroupAirlineController.saveLogsystem(
        username,
        "Group Airline Updated",
        `ID: ${galid}, Code: ${code}, Groupname: ${groupname}`
      );
    } catch (error) {
      console.log("Error in updategroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async newairlinedetails(req, res) {
    const { username, setTokenkey } = req.query;
    const { galid, cusid } = req.body;
    try {
      if (!username || !setTokenkey) {
        return SendError400(
          res,
          "Missing username or tokenkey in query parameters"
        );
      }
      const tokenKey = await GroupAirlineController.fetchTokenKeyForUser(
        username
      );
      if (!tokenKey) {
        return SendError400(res, "Not found your tokenkey, error");
      }
      if (tokenKey === setTokenkey) {
        /*this is check data first */
        const client = await connected.connect();
        await client.query("BEGIN"); // Start transaction
        const checkExistenceQuery =
          "select aldid from airlinedetails where (galid =$1 and cusid = $2 and active = 'Y') Order by aldid desc limit 1";
        const existenceResult = await client.query(checkExistenceQuery, [
          galid.trim(),
          cusid.trim(),
        ]);
        if (existenceResult.rows.length > 0) {
          await client.query("ROLLBACK"); // Rollback transaction
          return SendDuplicateData(
            res,
            "This data have been already created or duplicate data"
          );
        }

        const validationErrors = ValidateData({ galid, cusid });
        if (validationErrors.length > 0) {
          return SendDuplicateData(res, validationErrors);
        }

        //this is save data
        const sqlQuery = "Call pd_newairlinedetails ($1, $2, $3)";
        const queryParams = [galid, cusid, username];
        connected.query(sqlQuery, queryParams, async (err, result) => {
          if (err) return SendError(res, 500, EMessage.ErrorInsert, err);
          return SendCreate(res, 200, "Created", SMessage.Insert);
        });
      }
    } catch (error) {
      console.log("Error in newairlinedetails:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async showairlinedetails(req, res) {
    const { username, setTokenkey } = req.query;
    const {
      page = 1,
      limit = 10,
      searchtext = "",
      search_startdate = "",
      search_enddate = "",
    } = req.query;
    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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
        return SendDuplicateData(res, EMessage.Unauthorized, "Token key mismatch");
      }

      const offset = (page - 1) * limit;
      let sqlQuery = "";
      const queryParams = [];

      if (
        searchtext === "" &&
        search_startdate === "" &&
        search_enddate === ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_airlinedetails order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else if (
        searchtext !== "" &&
        search_startdate === "" &&
        search_enddate === ""
      ) {
        sqlQuery = `SELECT * FROM vm_airlinedetails WHERE groupcode LIKE $3 or groupname LIKE $3 or "customerFull" LIKE $3 or "customerCode" LIKE $3 or "customerName" LIKE $3 order by createdate desc LIMIT $1 OFFSET $2`;
        queryParams.push(limit, offset, searchtext);
      } else if (
        searchtext === "" &&
        search_startdate === "" &&
        search_enddate === ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_airlinedetails WHERE createdate >= $3 AND createdate <= $4 order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(
          limit,
          offset,
          search_startdate,
          search_enddate + " " + "23:59:59.999999"
        );
      } else {
        sqlQuery = `SELECT * FROM vm_airlinedetails WHERE (groupcode LIKE $3 or groupname LIKE $3 or "customerFull" LIKE $3 or "customerCode" LIKE $3 or "customerName" LIKE $3 OR createdate >= $4 AND createdate <= $5) order by createdate desc LIMIT $1 OFFSET $2`;
        queryParams.push(
          limit,
          offset,
          searchtext,
          search_startdate,
          search_enddate + " " + "23:59:59.999999"
        );
      }
      //   console.log(sqlQuery);
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            404,
            EMessage.NotFound || "Error fetching data details",
            err
          );
        }
        if (!result.rows || result.rows.length === 0) {
          return SendError(
            res,
            404,
            EMessage.NotFound + " No data details found"
          );
        }
        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });
    } catch (error) {
      console.log("Error in showairlinedetails:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updategroupairlinedetails(req, res) {
    const { username, setTokenkey } = req.query;
    const { aldid, galid, cusid } = req.body;
    try {
      if (!username || !setTokenkey || !aldid || !galid || !cusid)
        return SendError400(res, "Missing username in query parameters");

      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
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

      /*this is check data first*/
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "select aldid from airlinedetails where galid = $1 and cusid = $2 and active = 'Y' order by aldid desc limit 1";
      const existenceResult = await client.query(checkExistenceQuery, [
        galid.trim(),
        cusid.trim(),
      ]);
      if (existenceResult.rows.length > 0) {
        await client.query("ROLLBACK"); // Rollback transaction
        return SendError(
          res,
          409,
          "This data have been already created or duplicate data"
        );
      }
      const validationErrors = ValidateData({ galid, cusid });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }
      const sqlQuery =
        "Update airlinedetails set galid = $1, cusid = $2 where aldid = $3";
      const queryParams = [galid.trim(), cusid.trim(), aldid];
      connected.query(sqlQuery, queryParams, async (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error updating group airline details",
            err
          );
        }
        return SendCreate(res, 200, "Updated id :" + aldid, SMessage.Update);
      });
      /*this is save log*/
      const savelog = await GroupAirlineController.saveLogsystem(
        username,
        "Airline Details Updated",
        `ID: ${aldid}, Galid: ${galid}, Cusid: ${cusid}`
      );
    } catch (error) {
      console.log("Error in updategroupairlinedetails:", error);
      SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async deletegroupairlinedetails(req, res) {
    const { username, setTokenkey } = req.query;
    const { aldid } = req.body;
    try {
      if (!username || !setTokenkey || !aldid)
        return SendError400(res, "Missing username in query parameters");
      const tokenkey = await GroupAirlineController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey) {
        return SendErrorTokenkey(res, 400, EMessage.NotFound, "Token key not found");
      }
      if (setTokenkey !== tokenkey)
        return SendErrorTokenkey(res, 401, EMessage.Unauthorized, "Token key mismatch");

      const sqlQuery =
        "update airlinedetails set active = 'N' where aldid = $1";
      const parameter = [aldid];
      connected.query(sqlQuery, parameter, async (err, result) => {
        if (err) return SendError(res, 500, EMessage.ErrorUpdate, err);
        return SendCreate(res, 200, "Deleted id :" + aldid, SMessage.Delete);
      });
      //this is save log system
      const savelog = await GroupAirlineController.saveLogsystem(
        username,
        "Delete Airline Details",
        `aldid: ${aldid}` // Corrected "aldid"
      );
    } catch (error) {
      // console.log("Error in deletegroupairlinedetails:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
