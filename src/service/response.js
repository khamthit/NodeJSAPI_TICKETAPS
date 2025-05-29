export const SendCreate = (res, statusCode, message,data)=>{
    res.status(201).json({success: true, statusCode, message,data})
}
export const SendSuccess =(res,message,data)=>{
    res.status(200).json({success: true, statusCode: 200,message,data});
}
export const SendError400 = (res, message,error)=>{
    res.status(400).json({success: false, statusCode:400, message,error,data:{}}) // Bad Request
}
export const SendError = (res,status,message,error)=>{
    res.status(status).json({success: false, statusCode:404, message, error, data:{}}) 
}
export const SendSuccessWithReturnKeygen = (res, message, statusCode, data, tokenkey) => {
    res.status(statusCode).json({
        success: true,
        message,
        statusCode,
        data,
        tokenkey
    });
}

export const SendDuplicateData = (res, message,error)=>{
    res.status(409).json({success: false, statusCode:409, message,error,data:{}}) // Bad Request
}

export const SendErrorTokenkey = (res, statusCode, message, error)=>{
    res.status(statusCode).json({success: false, statusCode, message, error, data:{}}) 
}
