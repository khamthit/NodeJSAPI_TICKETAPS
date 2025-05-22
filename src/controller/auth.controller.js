import {
  SendCreate,
  SendError,
  SendError400,
  SendSuccess,
} from "../service/response.js";
import { ValidateData } from "../service/validate.js";
import CryptoJS from "crypto-js";
import { SECREAT_KEY } from "../config/globalKey.js";
import connected from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import { EMessage, ROLE, SMessage } from "../service/message.js";
import { GenerateToken, VerifyRefreshToken, VerifyToken } from "../service/service.js";
export default class AuthController {
  static async getAll(req, res) {
    try {
      const users = "Select * from user";
      connected.query(users, (err, result) => {
        if (err) return SendError(res, 404, EMessage.NotFound + " user", err);
        if (!result[0]) return SendError(res, 404, EMessage.NotFound + " user");
        return SendSuccess(res, SMessage.SelectAll, result);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async getOne(req, res) {
    try {
      const uuid = req.params.uuid; // 1 body: {} 2 params ແມ່ນ string ທີ່ຈະຢູ່ກັບ url , 3 query ຄ້າຍຄືກັບ params ແຕ່ສາມາດຂຽນຂໍ້ມູນໃນ url ໄດ້
      const checkUuid = "select * from user where uuid=?";
      connected.query(checkUuid, uuid, (err, result) => {
        if (err) return SendError(res, 404, EMessage.NotFound + " user", err);
        if (!result[0]) return SendError(res, 404, EMessage.NotFound + " user");
        return SendSuccess(res, SMessage.SelectOne, result[0]);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async forgotPassword(req, res) {
    try {
      const { email, newPassword } = req.body;
      const validate = await ValidateData({ email, newPassword });
      if (validate.length > 0) {
        return SendError400(res, EMessage.PleaseInput + validate.join(","));
      }

      const checkEmail = "select * from user where email=?";
      connected.query(checkEmail, email, (err, result) => {
        if (err) return SendError(res, 404, EMessage.NotFound + "email", err);
        if (!result[0])
          return SendError(res, 404, EMessage.NotFound + " email");
        const genPassword = CryptoJS.AES.encrypt(
          newPassword,
          SECREAT_KEY
        ).toString();
        const update = "Update user set password=? where uuid=?";
        connected.query(
          update,
          [genPassword, result[0]["uuid"]],
          (error, data) => {
            if (error) return SendError(res, 404, EMessage.NotFound, error);
            return SendSuccess(res, SMessage.Update);
          }
        );
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async changePassword(req, res) {
    try {
      const uuid = req.user;

      const { oldPassword, newPassword } = req.body;
      const validate = await ValidateData({ oldPassword, newPassword });
      if (validate.length > 0) {
        return SendError400(res, EMessage.PleaseInput + validate.join(","));
      }
      const checkPassword = "Select * from user where uuid=?";
      connected.query(checkPassword, uuid, (err, result) => {
        if (err) return SendError(res, 404, EMessage.NotFound + " user", err);
        if (!result[0]) return SendError(res, 404, EMessage.NotFound);
        const decrypt = CryptoJS.AES.decrypt(
          result[0]["password"],
          SECREAT_KEY
        ).toString(CryptoJS.enc.Utf8);

        if (oldPassword !== decrypt) {
          return SendError(res, 404, EMessage.IsMatch);
        }
        const update = "update user set password=? where uuid=?";
        const genPassword = CryptoJS.AES.encrypt(
          newPassword,
          SECREAT_KEY
        ).toString();
        connected.query(update, [genPassword, result[0]["uuid"]], (error) => {
          if (error) return SendError(res, 404, EMessage.ErrorUpdate, error);

          return SendSuccess(res, SMessage.Update);
        });
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const validate = await ValidateData({ email, password });
      if (validate.length > 0) {
        return SendError400(res, EMessage.PleaseInput + validate.join(","));
      }
      const checkEmail = "Select * from user where email=?";
      connected.query(checkEmail, email, async (err, result) => {
        if (err) return SendError(res, 404, EMessage.NotFound, err);
        if (!result[0]) return SendError(res, 404, EMessage.NotFound); // data: [{}]
        // ຖອດລະຫັດ ແລະ ປຽບທຽບລະຫັດຜ່ານ
        const decryptPassword = CryptoJS.AES.decrypt(
          result[0]["password"],
          SECREAT_KEY
        ).toString(CryptoJS.enc.Utf8);
        if (decryptPassword != password) {
          return SendError(res, 404, EMessage.IsMatch);
        }
        const data = {
          id: result[0]["uuid"],
        };
        // generate token
        const token = await GenerateToken(data);
        // const newData = Object.assign(
        //   JSON.parse(JSON.stringify(result[0])),
        //   JSON.parse(JSON.stringify(token))
        // );
        const newdata = {
          ...result[0],
          ...token,
        };
        return SendSuccess(res, SMessage.Login, newdata);
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async refreshToken (req,res){
    try {
      const {refreshToken} = req.body;
      if(!refreshToken) return SendError400(res,EMessage.BadRequest + " refreshToken");
      const verify = await VerifyRefreshToken(refreshToken);
      if(!verify) return SendError(res,404,EMessage.NotFound);
      return SendSuccess(res,SMessage.Update , verify);
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
  static async register(req, res) {
    try {
      const { username, email, phoneNumber, password } = req.body;
      // validate data
      const validate = await ValidateData({
        username,
        email,
        phoneNumber,
        password,
      });
      if (validate.length > 0) {
        return SendError400(res, EMessage.PleaseInput + validate.join(","));
      }

      const checkEmail = "Select * from user where email=?";
      connected.query(checkEmail, email, (errEmail, isMatch) => {
        if (errEmail)
          return SendError(res, 404, EMessage.NotFound + " Email", errEmail);
        if (isMatch[0]) return SendError(res, 208, EMessage.EmailAlready);
        ///
        const uuid = uuidv4();
        const datetime = new Date()
          .toISOString()
          .replace(/T/, " ")
          .replace(/\..+/, ""); //
        const genPassword = CryptoJS.AES.encrypt(
          password,
          SECREAT_KEY
        ).toString();
        //SQL QUERY ການສ້າງ insert into table user
        const insert = `INSERT INTO user 
        (uuid,username,phoneNumber,email,password,role,createdAt,updatedAt) 
        VALUES (?,?,?,?,?,?,?,?) `;
        // let nsert = "INSERT INTO user (uuid,username,phoneNumber,email,password,role,createdAt,updatedAt ) VALUES (?,?,?,?,?,?,?,?) ";
        connected.query(
          insert,
          [
            uuid,
            username,
            phoneNumber,
            email,
            genPassword,
            ROLE.user,
            datetime,
            datetime,
          ],
          function (err) {
            if (err) return SendError(res, 409, EMessage.ErrorInsert);
            const newData = {
              ...req.body,
              uuid: uuid,
              role: ROLE.user,
              createdAt: datetime,
              updatedAt: datetime,
            };
            return SendCreate(res, SMessage.Register);
          }
        );
      });
    } catch (error) {
      return SendError(res, 500, EMessage.ServerError, error);
    }
  }
}
