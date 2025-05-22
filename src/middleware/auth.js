import { EMessage } from "../service/message.js";
import { SendError, SendError400 } from "../service/response.js";
import { VerifyToken } from "../service/service.js";

export const auth = async (req,res,next)=>{
    try {
        const header = req.headers['authorization'];
        if(!header) {
            return SendError400(res,EMessage.BadRequest + "token");
        }
        const token = header.replace("Bearer ","");
        if(!token) return SendError(res,401,EMessage.Unauthorized);
        const user = await VerifyToken(token);
        req.user = user.uuid
        next()
    } catch (error) {
        return SendError(res,500,EMessage.ServerError,error)
    }
}