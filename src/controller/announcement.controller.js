import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import {
  SendCreate,
  SendError,
  SendError400,
  SendSuccess,
  SendErrorTokenkey,
  SendDuplicateData,
  SendSuccessAndFectDataAnnouncement,
  SendSuccessDisplay
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";
import { UploadImageToServer, UploadImageAnnouncementToServer } from "../config/cloudinary.js";
import fs from "fs";
import path from "path"; // Import the 'path' module

import { Console, group } from "console";
import { connect } from "http2";
import { start } from "repl";

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

  static async fetchTokenKeyForUserAirLine(username) {
    return new Promise((resolve, reject) => {
      if (!username) {
        return resolve(null);
      }
      const sqlQuery = `select "tokenKey" from "UsersAirline" where "userEmail" = $1 and "statusId" = 1`;
      connected.query(sqlQuery, [username], (err, result) => {
        if (err) {
          return reject(
            new Error("Database query failed while fetching token key.")
          );
        }
        if (!result || !result.rows || result.rows.length === 0) {
          return resolve(null);
        }
        //  console.log("Tokenkey found:", result.rows[0].tokenKey);
        resolve(result.rows[0].tokenKey);
      });
    });
  }

  static async fectTargetaudience(tgadid) {
    return new Promise((resolve, reject) => {
      if (!tgadid) {
        console.log("No emailorphone provided");
        return resolve(null);
      }
      const sqlQuery = "select audience from targetaudience where tgadid = $1";
      connected.query(sqlQuery, [tgadid], (err, result) => {
        if (err) {
          //   console.log("Database error fetching tokenkey:", err);
          return reject(
            new Error("Database query failed while fetching targetaudience id.")
          );
        }
        if (!result || !result.rows || result.rows.length === 0) {
          return resolve(null);
        }
        resolve(result.rows[0].audience);
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
      //console.error("Error in showgroupline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updateannouncementdetailActionStatus(req, res){
    const { username, setTokenkey } = req.query;
    const { aicmid, actionStatus } = req.body;

    if (!username || !setTokenkey || !aicmid || !actionStatus) {
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
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
      }
      let sqlQuery = "";
      if (actionStatus !== "Delete") {
        sqlQuery = "UPDATE announcementdetails SET statuscode = $1::varchar(255), statusname = $1::varchar(255) Where aicmid = $2";        
      }else{
        sqlQuery = "UPDATE announcementdetails SET statuscode = $1::varchar(255), statusname = $1::varchar(255), active = 'N' Where aicmid = $2";
      }      
      const queryParams = [actionStatus, aicmid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error updating announcement details",
            err
          );
        }
        return SendCreate(
          res,
          200,
          "Updated announcement detail status",
          SMessage.Update
        );
      });
    } catch (error) {
      console.error("Error in updateannouncementdetailActionStatus:", error);
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
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
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
        return SendErrorTokenkey(
          res,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
      }
      const sqlQuery =
        "update targetaudience set active = 'N' where tgadid = $1";
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
          return SendError(res, 400, EMessage.NotFound);
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

      const sqlQuery =
        "UPDATE announcementstatus SET active = 'N' WHERE astid = $1";
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



  static async newannouncementdetails(req, res) {
    const { username, setTokenkey } = req.query;
    const {
      titleName,
      reasonText,
      astid,
      tgadid,
      startdate,
      enddate,
      scheduledate,
      schedulehour,
      cus_id,
      group_id,
    } = req.body;
    try {
      // Ensure all async operations are properly awaited and errors are caught.
      if (
        !username ||
        !setTokenkey ||
        !titleName ||
        !reasonText ||
        !astid ||
        !tgadid // tgadid is expected to be a number or string convertible to number
      ) {
        return SendError400(
          res,
          "Missing required fields in request query or body."
        );
      }

      //this is fect data targetaudience
      const audience = await AnnoucementController.fectTargetaudience(tgadid);
      console.log("audience : ", audience);

      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (!tokenkey || tokenkey !== setTokenkey) {
        return SendErrorTokenkey(
          res,
          401, // Status code
          EMessage.Unauthorized,
          "Token key mismatch or not found."
        );
      }

      // Image Upload Handling
       let image_url = ""; // Initialize image_url, it will be empty if no file or upload fails (if handled that way)
      if (req.files && req.files.fileattach) {
        const imageFile = req.files.fileattach; // imageFile is the uploaded file object
        console.log("Image file received:", imageFile); // Debugging log
          const uploadedImageUrl = await UploadImageAnnouncementToServer(imageFile);
          if (!uploadedImageUrl) {
            // If a file was provided but upload failed, it's an error.
            return SendError400(
              res,
              EMessage.ErrorUploadImage + " - File upload failed."
            );
          }
          image_url = uploadedImageUrl;
          console.log("Image URL after upload:", imageFile); // Debugging log
      }  
      console.log("Image URL:", req.files);

      const validationErrors = ValidateData({ titleName, reasonText });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQueryInsertAnnouncement =
        "CALL pd_newannouncementdetails($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)";
      const queryParamsInsert = [
        titleName.trim(),
        reasonText.trim(),
        astid,
        tgadid,
        startdate || null,
        enddate || null,
        scheduledate || null,
        schedulehour || null,
        username,
        image_url,
        cus_id || null, 
      ];

      let get_aicmid;

      const resultInsert = await new Promise((resolve, reject) => {
        connected.query(
          sqlQueryInsertAnnouncement,
          queryParamsInsert,
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
      });

      const idColumnName = "out_aicmid";
      if (
        resultInsert.rows &&
        resultInsert.rows.length > 0 &&
        resultInsert.rows[0][idColumnName] !== undefined
      ) {
        get_aicmid = resultInsert.rows[0][idColumnName];
      } else {
        console.warn(
          `Stored procedure pd_newannouncementdetails executed but did not return '${idColumnName}'.`
        );
        return SendError(
          res,
          500,
          EMessage.ServerError,
          "Failed to retrieve announcement ID after creation."
        );
      }
      if (!get_aicmid) {
        return SendError(
          res,
          500,
          EMessage.ServerError,
          "Announcement ID is invalid after creation."
        );
      }
      console.log("Created announcement detail. ID:", get_aicmid);

      // Second Stored Procedure: Save target audience details
      let sqlSaveTargetAudience;
      let queryParamsTargetAudience;
      const numericTgadid = Number(tgadid);

      if (numericTgadid === 1) {
        // All customers
        sqlSaveTargetAudience =
          "CALL pd_newannouncementdetailtargetaudience($1, $2, $3, $4)";
        queryParamsTargetAudience = [get_aicmid, numericTgadid, username, 0]; // 0 for 'all customers'
      } else if (numericTgadid === 2) {
        // Specific customer
        if (!cus_id) {
          return SendError400(
            res,
            "Missing cus_id for target audience type 'specific customer'."
          );
        }
        sqlSaveTargetAudience =
          "CALL pd_newannouncementdetailtargetaudience($1, $2, $3, $4)";
        queryParamsTargetAudience = [
          get_aicmid,
          numericTgadid,
          username,
          cus_id,
        ];
      } else if (numericTgadid === 3) {
        // Specific group (assuming tgadid 3 is for group)
        if (!group_id) {
          return SendError400(
            res,
            "Missing group_id for target audience type 'specific group'."
          );
        }
        sqlSaveTargetAudience =
          "CALL pd_newannouncementdetailtargetaudience($1, $2, $3, $4)"; // Assuming procedure handles group_id
        queryParamsTargetAudience = [
          get_aicmid,
          numericTgadid,
          username,
          group_id,
        ];
      } else {
        console.log(
          `No specific target audience action for tgadid: ${numericTgadid}`
        );
      }

      if (sqlSaveTargetAudience && queryParamsTargetAudience) {
        await new Promise((resolve, reject) => {
          connected.query(
            sqlSaveTargetAudience,
            queryParamsTargetAudience,
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );
        });
        console.log(`Processed target audience for tgadid: ${numericTgadid}`);
      }

      //return SendCreate(res, 200, SMessage.Insert, { id: get_aicmid, message: "Announcement created and target audience processed." });

      //This is fect data by announcementdetailTargetaudience by aicmid
      const sqldata =
        "Select * from announcementdetailTargetaudience where aicmid = $1";
      const queryParamsdata = [get_aicmid];
      connected.query(sqldata, queryParamsdata, (err, result) => {
        if (err) {
          return SendError(res, 500, EMessage.ErrorSelect, err);
        }

        return SendSuccessAndFectDataAnnouncement(
          res,
          audience,
          titleName,
          reasonText,
          startdate,
          enddate,
          scheduledate,
          SMessage.SelectAll,
          result.rows
        );
      });
    } catch (error) {
      console.error("Error in newannouncementdetails:", error);
      return SendError(
        res,
        500,
        EMessage.ServerError,
        error.message || "An unexpected error occurred."
      );
    }
  }

  static async showannouncementdetails(req, res) {
    const { username, setTokenkey } = req.query;
    let { // Changed to let for parsing
      page = 1,
      limit = 10,
      searchtext = "",
      searchStatus = "", // Assuming this corresponds to astid
      searchStartdate = "",
      searchEnddate = "",
    } = req.query;

    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(username);
      if (!tokenkey) {
        return SendErrorTokenkey(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }
      if (setTokenkey !== tokenkey) {
        return SendErrorTokenkey(
          res,
          401,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
      }
      // Parse and validate page and limit
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      const offset = (page - 1) * limit;      
      const selectFields = "aicmid, titlename, reasontext, anid, anouncementcode, astid, statuscode, statusname, tgadid, audience_code, audience_name, cus_id, startdate, enddate, createby, scheduledate, schedulehour, attachfile, createdate, active";
      const fromTable = "vm_announcementdetailbyAirline";      
      let effectiveWhereClauses = ["active = 'Y'"];
      const queryParamsForWhere = []; // Parameters for the WHERE clause (used by both count and data queries)
      let placeholderIndex = 1;
      if (searchtext) {
        effectiveWhereClauses.push(`(titlename ILIKE $${placeholderIndex} OR reasontext ILIKE $${placeholderIndex} OR anouncementcode ILIKE $${placeholderIndex} OR statuscode ILIKE $${placeholderIndex} OR statusname ILIKE $${placeholderIndex})`);
        queryParamsForWhere.push(`%${searchtext}%`);
        placeholderIndex++;
      }
      if (searchStatus) { // Assuming searchStatus is for astid (status ID)
        effectiveWhereClauses.push(`astid = $${placeholderIndex}`); // Use the correct column name from the view
        queryParamsForWhere.push(searchStatus);
        placeholderIndex++;
      }
      if (searchStartdate && searchEnddate) {
        effectiveWhereClauses.push(`createdate >= $${placeholderIndex}`);
        queryParamsForWhere.push(searchStartdate);
        placeholderIndex++;
        effectiveWhereClauses.push(`createdate <= $${placeholderIndex}`);
        queryParamsForWhere.push(searchEnddate + " " + "23:59:59.999999");
        placeholderIndex++;
      }      
      const whereClauseString = effectiveWhereClauses.join(" AND ");      
      const countSql = `SELECT COUNT(*) AS total_count FROM ${fromTable} WHERE ${whereClauseString}`;
      connected.query(countSql, queryParamsForWhere, (countErr, countResult) => {
        if (countErr) {
          console.error("Error fetching announcement count:", countErr);
          return SendError(
            res,
            500,
            EMessage.ErrorSelect || "Error fetching announcement count",
            countErr
          );
        }        
        const totalCount = parseInt(countResult.rows[0].total_count, 10);
        const totalPages = Math.ceil(totalCount / limit);
        if (page > totalPages) {
             return SendSuccessDisplay(res, EMessage.NotFound, [], totalPages, totalCount);
        }        
        const dataSql = `SELECT ${selectFields} FROM ${fromTable} WHERE ${whereClauseString} ORDER BY createdate DESC LIMIT $${placeholderIndex} OFFSET $${placeholderIndex + 1}`;
        const queryParamsForData = [...queryParamsForWhere, limit, offset];

        connected.query(dataSql, queryParamsForData, (err, dataResult) => {
          if (err) return SendError400(res, EMessage.ErrorSelect, err); 
          return SendSuccessDisplay(res, SMessage.SelectAll, dataResult.rows, totalPages, totalCount);

        });
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, "An unexpected error occurred.");
    }
  }

  static async showannouncementdetailsAdmin(req, res) {
    const { username, setTokenkey } = req.query;
    let { // Changed to let for parsing
      page = 1,
      limit = 10,
      searchtext = "",
      searchStatus = "", // Assuming this corresponds to astid
      searchStartdate = "",
      searchEnddate = "",
    } = req.query;

    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
      if (!tokenkey) {
        return SendErrorTokenkey(
          res,
          401,
          EMessage.Unauthorized,
          "Token key not found or invalid for user"
        );
      }
      if (setTokenkey !== tokenkey) {
        return SendErrorTokenkey(
          res,
          401,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
      }
      // Parse and validate page and limit
      page = parseInt(page, 10);
      limit = parseInt(limit, 10);
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      const offset = (page - 1) * limit;      
      const selectFields = "aicmid, titlename, reasontext, anid, anouncementcode, astid, statuscode, statusname, tgadid, audience_code, audience_name, cus_id, startdate, enddate, createby, scheduledate, schedulehour, attachfile, createdate, active";
      const fromTable = "announcementdetails";      
      let effectiveWhereClauses = ["active = 'Y'"];
      const queryParamsForWhere = []; // Parameters for the WHERE clause (used by both count and data queries)
      let placeholderIndex = 1;
      if (searchtext) {
        effectiveWhereClauses.push(`(titlename ILIKE $${placeholderIndex} OR reasontext ILIKE $${placeholderIndex} OR anouncementcode ILIKE $${placeholderIndex} OR statuscode ILIKE $${placeholderIndex} OR statusname ILIKE $${placeholderIndex})`);
        queryParamsForWhere.push(`%${searchtext}%`);
        placeholderIndex++;
      }
      if (searchStatus) { // Assuming searchStatus is for astid (status ID)
        effectiveWhereClauses.push(`astid = $${placeholderIndex}`);
        queryParamsForWhere.push(searchStatus);
        placeholderIndex++;
      }
      if (searchStartdate && searchEnddate) {
        effectiveWhereClauses.push(`createdate >= $${placeholderIndex}`);
        queryParamsForWhere.push(searchStartdate);
        placeholderIndex++;
        effectiveWhereClauses.push(`createdate <= $${placeholderIndex}`);
        queryParamsForWhere.push(searchEnddate + " " + "23:59:59.999999");
        placeholderIndex++;
      }      
      const whereClauseString = effectiveWhereClauses.join(" AND ");      
      const countSql = `SELECT COUNT(*) AS total_count FROM ${fromTable} WHERE ${whereClauseString}`;
      connected.query(countSql, queryParamsForWhere, (countErr, countResult) => {
        if (countErr) {
          console.error("Error fetching announcement count:", countErr);
          return SendError(
            res,
            500,
            EMessage.ErrorSelect || "Error fetching announcement count",
            countErr
          );
        }        
        const totalCount = parseInt(countResult.rows[0].total_count, 10);
        const totalPages = Math.ceil(totalCount / limit);
        if (page > totalPages) {
             return SendSuccessDisplay(res, EMessage.NotFound, [], totalPages, totalCount);
        }        
        const dataSql = `SELECT ${selectFields} FROM ${fromTable} WHERE ${whereClauseString} ORDER BY createdate DESC LIMIT $${placeholderIndex} OFFSET $${placeholderIndex + 1}`;
        const queryParamsForData = [...queryParamsForWhere, limit, offset];

        connected.query(dataSql, queryParamsForData, (err, dataResult) => {
          if (err) return SendError400(res, EMessage.ErrorSelect, err); 
          return SendSuccessDisplay(res, SMessage.SelectAll, dataResult.rows, totalPages, totalCount);

        });
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, "An unexpected error occurred.");
    }
  }

  static async showannouncementbyAirline(req, res) {
    const { username, setTokenkey } = req.query;
    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(username);
    if (!tokenkey || tokenkey !== setTokenkey) {
      return SendErrorTokenkey(
        res,
        401,
        EMessage.Unauthorized,
        "Token key not found or invalid for user"
      );
    }
    try {
       const sqlQuery =
        "select * from vm_announcementdetailbyAirline where createby = $1 order by createdate desc";
      const queryParams = [username];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) return SendError400(res, EMessage.ErrorSelect, err);
        if (!result.rows || result.rows.length === 0)
          return SendError400(res, EMessage.NotFound);
        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });

    } catch (error) {
      console.error("Error in showannouncementbyAirline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
      
    }
  }

  static async showannouncementbyAirlineUnread(req, res) {
    const { username, setTokenkey } = req.query;
    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(username);
    if (!tokenkey || tokenkey !== setTokenkey) {
      return SendErrorTokenkey(
        res,
        401,
        EMessage.Unauthorized,
        "Token key not found or invalid for user"
      );
    }
    try {
       const sqlQuery =
        "select * from vm_announcementdetailbyAirline where createby = $1 and readstatus = 'Not Read' order by createdate desc";
      const queryParams = [username];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) return SendError400(res, EMessage.ErrorSelect, err);
        if (!result.rows || result.rows.length === 0)
          return SendError400(res, EMessage.NotFound);
        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });

    } catch (error) {
      console.error("Error in showannouncementbyAirline:", error);
      return SendError(res, 500, EMessage.ServerError, error);
      
    }
  }


  static async fectannouncementdetailtargetaudiencebyAicmid(req, res) {
    const { username, setTokenkey } = req.query;
    const { aicmid } = req.query;

    if (!username || !setTokenkey || !aicmid) {
      return SendError400(res, "Missing username in query parameters");
    }
    const tokenkey = await AnnoucementController.fetchTokenKeyForUser(username);
    if (!tokenkey || tokenkey !== setTokenkey) {
      return SendErrorTokenkey(
        res,
        401,
        EMessage.Unauthorized,
        "Token key not found or invalid for user"
      );
    }
    try {
      const sqlQuery =
        "select atdtid, aicmid, tgadid, code, audience, customerfull, customercode, customername, COALESCE(cus_email, 'N/A') AS cusEmail, createdate, createby from announcementdetailTargetaudience where aicmid = $1 order by atdtid asc";
      const queryParams = [aicmid];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) return SendError400(res, EMessage.ErrorSelect, err);
        if (!result.rows || result.rows.length === 0)
          return SendError400(res, EMessage.NotFound);
        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });
    } catch (error) {
      // console.log("Error in fectannouncementdetailtargetaudiencebyAicmid:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async readannouncementdetail(req, res) {
    const { username, setTokenkey } = req.query;
    const { aicmid } = req.body;

    if (!username || !setTokenkey || !aicmid)
      return SendError400(res, "Missing username in query parameters");
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(
        username
      );
      if (!tokenkey || tokenkey !== setTokenkey)
        return SendError400(res, EMessage.Unauthorized);

      const sqlquery = "Update announcementsread set readstatus = 'Read' Where aicmid = $1 and createby = $2";
      const queryParams = [aicmid, username];
      connected.query(sqlquery, queryParams, (err, result) => {
        if (err) return SendError(res, 500, EMessage.ErrorInsert, err);
        return SendCreate(res, 200, SMessage.Insert);
      });

      /*this is save log*/
      const savelog = await AnnoucementController.saveLogsystem(
        username,
        "Read Announcement",
        `ID: ${aicmid}`
      );

    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async showreadannouncementdetail(req, res) {
    const { username, setTokenkey } = req.query;
    const { aicmid } = req.body;

    if (!username || !setTokenkey || !aicmid)
      return SendError400(res, "Missing username in query parameters");
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(
        username
      );
      if (!tokenkey || tokenkey !== setTokenkey)
        return SendError400(res, EMessage.Unauthorized);

      const sqlquery =
        "select n.aicmid, n.titlename, n.reasontext, n.anid, n.anouncementcode, n.astid, n.statuscode, n.statusname, n.tgadid, n.audience_code, n.audience_name, r.createby as readby, r.createdate as readdate from announcementdetails n inner join announcementsread r on r.aicmid = n.aicmid  where n.aicmid = $1 and r.createby = $2";
      const queryParams = [aicmid, username];
      connected.query(sqlquery, queryParams, (err, result) => {
        if (err) return SendError(res, 500, EMessage.ErrorSelect, err);
        if (!result.rows || result.rows.length === 0)
          return SendError400(res, EMessage.NotFound, +" Do not read.");

        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async showreadannouncementdetailbytargetaudienceincusid(req, res) {
    const { username, setTokenkey } = req.query;
    // const { cusid } = req.body;

    if (!username || !setTokenkey)
      return SendError400(res, "Missing username in query parameters");
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUserAirLine(
        username
      );
      
      if (!tokenkey || tokenkey !== setTokenkey)
        return SendError400(res, EMessage.Unauthorized);
      const sqlquery = "Select * from vm_announcementdetailbyAirline  where createby = $1 order by aicmid desc"
      const queryParams = [username];
      connected.query(sqlquery, queryParams, (err, result) => {
        if (err) return SendError(res, 500, EMessage.ErrorSelect, err);
        if (!result.rows || result.rows.length === 0)
          return SendError400(res, EMessage.NotFound);

        return SendSuccess(res, SMessage.SelectAll, result.rows);
      });
    } catch (error) {
      //console.error("Error in showreadannouncementdetailbytargetaudienceincusid:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updateannouncementdetailsServer(req, res) {
    const { username, setTokenkey } = req.query;
    const { aicmid, btndelete, titleName, reasonText, astid, tgadid, startdate, enddate, scheduledate, schedulehour } = req.body;

    if (!aicmid)
      return SendError400(res, "Missing username in query parameters");
    try {
      const tokenkey = await AnnoucementController.fetchTokenKeyForUser(
        username
      );
      if (setTokenkey !== tokenkey || !setTokenkey)
        return SendErrorTokenkey(
          res,
          401,
          EMessage.Unauthorized,
          "Token key mismatch"
        );
      //this is update data
      if (btndelete === "Y") {
        //this is for delete data
        const sqlquery =
          "Call pd_delAnnouncementDetails($1)";
        const queryParams = [aicmid];
        connected.query(sqlquery, queryParams, (err, dbResult) => { // Renamed 'res' to 'dbResult'
          if (err) return SendError(res, 500, EMessage.ErrorUpdate, err);
          return SendCreate(res, 200, SMessage.Delete);
        });

      } 

      if (btndelete === ""){
        //this is for update
        let attachment_url_update = null; // Default to null if no new file
        if (req.files && req.files.fileattach) {
          const attachedFileUpdate = req.files.fileattach;
          const uploadedFileUrlUpdate = await UploadImageToServer(attachedFileUpdate); // Pass the whole file object
          if (!uploadedFileUrlUpdate) {
            return SendError400(res, EMessage.ErrorUploadImage + " - File attachment upload failed for update.");
          }
          attachment_url_update = uploadedFileUrlUpdate;
        } else {
        }
        const sqlquery = "Call pd_updateannouncementdetails($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)";
        const queryParams = [
          aicmid,
          titleName.trim(),
          reasonText.trim(),
          astid,
          tgadid,
          startdate || null,
          enddate || null,
          username,
          scheduledate || null,
          schedulehour || null,
          attachment_url_update // Pass the new or existing file URL
        ];
        connected.query(sqlquery, queryParams, (err, result) => {
          if (err) return SendError(res, 500, EMessage.ErrorUpdate, err);
          return SendCreate(res, 200, SMessage.Update);
        });

        /*this is save log */
        const savelog = await AnnoucementController.saveLogsystem(
          username,
          "Update Announcement",
          `ID: ${aicmid}, titleName: ${titleName}, reasonText: ${reasonText}, astid: ${astid}, tgadid: ${tgadid}, startdate: ${startdate}, enddate: ${enddate}, scheduledate: ${scheduledate}, schedulehour: ${schedulehour}`);

      }
    } catch (error) {
      //console.log("Error in updateannouncementdetails:", error);
      SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
