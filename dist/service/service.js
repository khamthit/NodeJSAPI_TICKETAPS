import jwt from "jsonwebtoken";
import { SECREAT_KEY, SECREAT_KEY_REFRESH } from "../config/globalKey.js";
import CryptoJS from "crypto-js";
import connected from "../config/db.js";
import { SendError } from "./response.js";
import { EMessage } from "./message.js";
export const FindOneUser = async uuid => {
  return new Promise(async (resovle, reject) => {
    try {
      const checkuser = "Select * from user where uuid=?";
      connected.query(checkuser, uuid, (err, result) => {
        if (err) reject(err);
        if (!resovle[0]) {
          resovle(EMessage.NotFound);
        }
        resovle(result[0]);
      });
    } catch (error) {
      reject(error);
    }
  });
};
export const FindOneOrder = async oUuid => {
  return new Promise(async (resovle, reject) => {
    try {
      const checkorder = "Select * from tb_order where oUuid=?";
      connected.query(checkorder, oUuid, (err, result) => {
        if (err) reject(err);
        if (!resovle[0]) {
          resovle(EMessage.NotFound);
        }
        resovle(result[0]);
      });
    } catch (error) {
      reject(error);
    }
  });
};
export const FindOneOrderDetail = async ordUuid => {
  return new Promise(async (resovle, reject) => {
    try {
      const checkorderDetail = "Select * from order_detail where ordUuid=?";
      connected.query(checkorderDetail, ordUuid, (err, result) => {
        if (err) reject(err);
        if (!resovle[0]) {
          resovle(EMessage.NotFound);
        }
        resovle(result[0]);
      });
    } catch (error) {
      reject(error);
    }
  });
};
export const FindOneProduct = async pUuid => {
  return new Promise(async (resovle, reject) => {
    try {
      const checkproduct = "Select * from product where pUuid=?";
      connected.query(checkproduct, pUuid, (err, result) => {
        if (err) reject(err);
        if (!resovle[0]) {
          resovle(EMessage.NotFound);
        }
        resovle(result[0]);
      });
    } catch (error) {
      reject(error);
    }
  });
};
export const CheckEmail = async email => {
  return new Promise(async (resovle, reject) => {
    try {
      const checkEmail = "Select * from user where email=?";
      connected.query(checkEmail, email, (err, result) => {
        if (err) reject(err);
        if (result[0]) reject("Email Already");
        resovle(true);
      });
    } catch (error) {
      reject(error);
    }
  });
};
export const VerifyRefreshToken = async refresh => {
  return new Promise(async (resovle, reject) => {
    try {
      jwt.verify(refresh, SECREAT_KEY_REFRESH.toString(), async (err, decode) => {
        if (err) reject(err);
        const decript = CryptoJS.AES.decrypt(decode.id, SECREAT_KEY_REFRESH).toString(CryptoJS.enc.Utf8);
        const checkUuid = "Select * from user where uuid=?";
        connected.query(checkUuid, decript, async (error, result) => {
          if (error) reject(error);
          if (!result[0]) reject(EMessage.Unauthorized);
          const data = {
            id: result[0]["uuid"]
          };
          const token = await GenerateToken(data);
          if (!token) reject("Error Genpassword");
          resovle(token);
        });
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
};
export const VerifyToken = async token => {
  return new Promise(async (resovle, reject) => {
    try {
      jwt.verify(token, SECREAT_KEY.toString(), async (err, decode) => {
        if (err) reject(err);
        const decript = CryptoJS.AES.decrypt(decode.id, SECREAT_KEY).toString(CryptoJS.enc.Utf8);
        const checkUuid = "Select * from user where uuid=?";
        connected.query(checkUuid, decript, (error, result) => {
          if (error) reject(error);
          if (!result[0]) reject(EMessage.Unauthorized);
          resovle(result[0]);
        });
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
};
export const GenerateToken = async data => {
  return new Promise(async (resovle, reject) => {
    // promise ແມ່ນຫຍັງ
    try {
      const payload = {
        id: CryptoJS.AES.encrypt(data.id, SECREAT_KEY).toString()
      };
      const payload_refresh = {
        id: CryptoJS.AES.encrypt(data.id, SECREAT_KEY_REFRESH).toString()
      };
      const token = jwt.sign(payload, SECREAT_KEY, {
        expiresIn: "2h"
      });
      const refreshToken = jwt.sign(payload_refresh, SECREAT_KEY_REFRESH, {
        expiresIn: "4h"
      });
      resovle({
        token,
        refreshToken
      });
    } catch (error) {
      reject(error);
    }
  });
};