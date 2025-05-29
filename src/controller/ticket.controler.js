import connected from "../config/db.js";
import { EMessage, SMessage } from "../service/message.js";
import { UploadImageToCloud } from "../config/cloudinary.js";
import {
  SendCreate,
  SendDuplicateData,
  SendError,
  SendError400,
  SendSuccess,
  SendErrorTokenkey,
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";
import { UploadImageToServer } from "../config/cloudinary.js";
import fs from "fs";
import path from "path"; // Import the 'path' module

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

  static async showTicketCategory(req, res) {
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
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async createTicketCategory(req, res) {
    const { username, setTokenkey } = req.query;
    const { code, categoryname } = req.body;

    if (!username || !setTokenkey || !code || !categoryname) {
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

      if (setTokenkey !== tokenkey) {
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
        return SendDuplicateData(res, 409, EMessage.ErrorDuplicate);
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
          return SendDuplicateData(
            res,
            EMessage.ErrorDuplicate || "Error creating ticket category",
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
    const { username, setTokenkey } = req.query;
    const { tcid, code, categoryname } = req.body;

    if (!username || !setTokenkey || !tcid || !code || !categoryname) {
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

      if (setTokenkey !== tokenkey) {
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
    const { username, setTokenkey } = req.query;
    const { tcid } = req.body;

    if (!username || !setTokenkey || !tcid) {
      return SendError400(res, "Missing username in query parameters");
    }

    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
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
      console.log(error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async createticketdetail(req, res) {
    const { username, setTokenkey } = req.query;
    const { subject, email, tcid, ptid, descriptions } = req.body;
    // Comprehensive check for required fields
    if (
      !username ||
      !setTokenkey ||
      !subject ||
      !email ||
      !tcid ||
      !ptid ||
      !descriptions
    ) {
      // If a file was uploaded despite missing fields, attempt to clean it up.
      return SendError400(
        res,
        "Missing required fields in request query or body."
      );
    }

    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
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
      //image
      const image = req.files;
      // console.log("Image:", image.Image.name);
      const imagename = image.fileattach.name;
      const imageDataBuffer = image.fileattach.data;
      // console.log("Image Data Buffer:", imageDataBuffer);
      // console.log("Image Name:", imagename);
      // console.log("imagedata:", image.fileattach.data)
      const image_url = await UploadImageToServer(image.fileattach.data);
      if (!image) return SendError400(res, EMessage.BadRequest + " Image");
      if (!image_url) return SendError400(res, EMessage.ErrorUploadImage);

      const validationErrors = ValidateData({ subject, descriptions });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      console.log("Image Name:", image_url);

      const sqlQuery = "Call pd_TicketDetails($1, $2, $3, $4, $5, $6, $7)";
      // Ensure tcid and ptid are parsed as integers if your DB expects that
      const queryParams = [
        subject.trim(),
        email ? email.trim() : null, // Handle optional email
        parseInt(tcid, 10),
        parseInt(ptid, 10),
        descriptions.trim(),
        image_url, // This is already just the filename from multer, or null
        username,
      ];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorInsert || "Error creating ticket details",
            err
          );
        }
        return SendCreate(res, 200, "Created", SMessage.Insert);
      });
    } catch (error) {
      //console.error("Error in createticketdetail:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async showticketDetails(req, res) {
    const { username, setTokenkey } = req.query;
    const {
      page = 1,
      limit = 10,
      searchtext = "",
      searchStatus = "",
      searchCategory = "",
      searchStartdate = "",
      searchEnddate = "",
    } = req.query;

    if (!username || !setTokenkey) {
      return SendError400(res, "Missing username in query parameters");
    }
    try {
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
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

      const offset = (page - 1) * limit;
      let sqlQuery = "";
      const queryParams = [];

      if (
        searchtext === "" &&
        searchCategory === "" &&
        searchStatus === "" &&
        searchStartdate === "" &&
        searchEnddate === ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else if (
        (searchtext !== "" && searchCategory === "") ||
        (searchStatus === "" && searchStartdate === "" && searchEnddate === "")
      ) {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' AND (subject ILIKE $3 OR email ILIKE $3) order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, `%${searchtext}%`);
      } else if (
        searchtext === "" &&
        searchCategory !== "" &&
        searchStatus === "" &&
        searchStartdate === "" &&
        searchEnddate === ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' AND categorycode LIKE $3 order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, searchCategory);
      } else if (
        searchtext === "" &&
        searchCategory === "" &&
        searchStatus !== "" &&
        searchStartdate === "" &&
        searchEnddate === ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' AND statusName LIKE $3 order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset, searchStatus);
      } else if (
        searchtext === "" &&
        searchCategory === "" &&
        searchStatus === "" &&
        searchStartdate !== "" &&
        searchEnddate !== ""
      ) {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' AND createdate >= $3 AND createdate <= $4 order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(
          limit,
          offset,
          searchStartdate,
          searchEnddate + " " + "23:59:59.999999"
        );
      } else {
        sqlQuery =
          "SELECT * FROM vm_ticketdetails WHERE active = 'Y' AND (ticketcode LIKE $3 OR statusName LIKE $4 OR createdate >= $5 AND createdate <= $6) order by createdate desc LIMIT $1 OFFSET $2";
        queryParams.push(
          limit,
          offset,
          searchCategory,
          searchStatus,
          searchStartdate,
          searchEnddate + " " + "23:59:59.999999"
        );
      }

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.NotFound || "Error fetching ticket details",
            err
          );
        }

        if (!result.rows || result.rows.length === 0) {
          return SendError(
            res,
            404,
            EMessage.NotFound + " No ticket details found"
          );
        }
        const trimmedResult = result.rows.map((row) => {
          const {
            ticketid,
            ticket_code,
            category_code,
            category_categoryname,
            priority_code,
            priority_name,
            fileattach,
            ticketstatus,
            workerby,
            workernote,
            workerstart,
            workerend,
            reassingby,
            reassingbynode,
            reassingdate,
            createdate,
            createby,
            ...rest
          } = row;
          return {
            // ...row,
            ...rest,
            tcddid: row.tcddid, // Assuming tcid does not need trimming or is not a string
            ticketId: row.ticketid,
            ticketCode: row.ticketcode?.trim(),
            subject: row.subject?.trim(),
            descriptions: row.descriptions?.trim(),
            email: row.email?.trim(),
            categoryCode: row.categorycode?.trim(),
            categoryName: row.categorycategoryname?.trim(),
            priorityCode: row.prioritycode?.trim(),
            priorityName: row.priorityname?.trim(),
            createdate: row.createdate, // Assuming createdate does not need trimming
            createby: row.createby, // Assuming createby does not need trimming
            fileAttach: row.fileattach?.trim(),
            workerBy: row.workerby?.trim(),
            workerNoted: row.workernote?.trim(),
            workerStart: row.workerstart,
            workerEnd: row.workerend,
            reassingBy: row.reassingby?.trim(),
            reassingByNode: row.reassingbynode?.trim(),
            reassingDate: row.reassingdate,
            ticketStatus: row.ticketstatus?.trim(),
          };
        });
        // console.log(trimmedResult);
        return SendSuccess(res, SMessage.SelectAll, trimmedResult);
        // return SendSuccess(res, SMessage.SelectAll, result.rows);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async ticketchangestatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { ticket_code, stid, workernoted } = req.body;

    if (!username || !setTokenkey || !ticket_code || !stid) {
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

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }
      let sqlQuery = "";
      sqlQuery = "UPDATE ticketdetails SET stid = $1, workerby = $2, workernote = $3, workerend = Now() WHERE ticket_code = $4";

      const queryParams = [
        stid.trim(),
        username.trim(),
        workernoted.trim(),
        ticket_code.trim(),
      ];

      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error updating ticket status",
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
      //console.error("Error in ticketchangestatus:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async ticketdetailsreassign(req, res) {
    const { username, setTokenkey } = req.query;
    const { ticket_code, reassignto, reassingnote } = req.body;
    if (!username || !setTokenkey || !ticket_code || !reassignto) {
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
      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }
      const sqlQuery =
        "UPDATE ticketdetails SET workerby = $1, reassingbynode = $2, reassingby=$3 WHERE ticket_code = $4";
      const queryParams = [
        reassignto.trim(),
        reassingnote.trim(),
        username.trim(),
        ticket_code.trim(),
      ];
      connected.query(sqlQuery, queryParams, (err, result) => {
        if (err) {
          return SendError(
            res,
            500,
            EMessage.ErrorUpdate || "Error reassigning ticket details",
            err
          );
        }
        return SendCreate(
          res,
          200,
          "Reassigned",
          SMessage.Update || "Reassign Success"
        );
      });
      //this is save log system
      const savelog = await TicketController.saveLogsystem(
        username,
        "Reassign Ticket",
        `Ticket Code: ${ticket_code}, Reassigned to: ${reassignto}, Note: ${reassingnote}`
      );
      if (!savelog) {
        console.error("Failed to save log for ticket reassignment");
      }
    } catch (error) {
      // console.error("Error in ticketdetailsreassign:", error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async openImage(req, res) {
    const { username, setTokenkey } = req.query;
    let { imagename } = req.body; // Use let if you might reassign it (though not in this version)
    if (!username || !setTokenkey || !imagename) {
      return SendError400(res, "Missing required parameters.");
    }
    try {
      // Authenticate and authorize the user
      const tokenkey = await TicketController.fetchTokenKeyForUser(username);
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
      // path.basename will return only the filename part.
      const safeImageName = path.basename(imagename);
      const imagePath = path.join(
        process.cwd(),
        "assets",
        "images",
        safeImageName
      );

      if (!fs.existsSync(imagePath)) {
        console.error(`Image not found at path: ${imagePath}`); // Helpful for debugging
        return SendError(res, 404, "Image not found");
      }

      // res.sendFile requires an absolute path.
      res.sendFile(imagePath, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          // Avoid sending another response if headers already sent by res.sendFile on error
          if (!res.headersSent) {
            SendError(res, 500, "Error sending image file.", err);
          }
        }
      });
    } catch (error) {
      // console.error("Error in openImage:", error); // Log the actual error
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async createsystemstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { code, statusname } = req.body;

    if (!username || !setTokenkey || !code || !statusname) {
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

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      //this is for check data first
      const client = await connected.connect();
      await client.query("BEGIN"); // Start transaction
      const checkExistenceQuery =
        "SELECT stid FROM systemstatus WHERE (code = $1 OR statusname = $2) And active = 'Y'";
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
        "INSERT INTO systemstatus (code, statusname, createdate, createby, active) VALUES ($1, $2, NOW(), $3, 'Y') RETURNING stid";
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
      const savelog = await TicketController.saveLogsystem(
        username,
        "System Status Saved",
        `Code: ${code}, statusname: ${statusname}`
      );
    } catch (error) {
      console.log(error);
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async updatesystemstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { stid, code, statusname } = req.body;

    if (!username || !setTokenkey || !stid || !code || !statusname) {
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

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const validationErrors = ValidateData({ code, statusname });
      if (validationErrors.length > 0) {
        return SendError400(res, validationErrors);
      }

      const sqlQuery =
        "UPDATE systemstatus SET code = $1, statusname = $2 WHERE stid = $3";
      const queryParams = [code.trim(), statusname.trim(), stid];
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
      const savelog = await TicketController.saveLogsystem(
        username,
        "System Status Update",
        `ID: ${stid}, Code: ${code}, statusname: ${statusname}`
      );
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }

  static async deletesystemstatus(req, res) {
    const { username, setTokenkey } = req.query;
    const { stid } = req.body;

    if (!username || !setTokenkey || !stid) {
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

      if (setTokenkey !== tokenkey) {
        return SendError(res, 401, EMessage.Unauthorized, "Token key mismatch");
      }

      const sqlQuery = "UPDATE systemstatus SET active = 'N' WHERE stid = $1";
      const queryParams = [stid];
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
      const savelog = await TicketController.saveLogsystem(
        username,
        "System Status Deleted",
        `ID: ${stid}`
      );
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async showSystemStatus(req, res) {
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
          "SELECT * FROM systemstatus WHERE active = 'Y' order by code asc LIMIT $1 OFFSET $2";
        queryParams.push(limit, offset);
      } else {
        sqlQuery =
          "SELECT * FROM systemstatus WHERE active = 'Y' AND (code ILIKE $3 OR statusname ILIKE $3) order by code asc LIMIT $1 OFFSET $2";
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
        if (setTokenkey === tokenkey) {
          const trimmedResult = result.rows.map((row) => {
            return {
              ...row,
              stid: row.stid, // Assuming tcid does not need trimming or is not a string
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
            "Token key mismatch"
          );
        }
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
