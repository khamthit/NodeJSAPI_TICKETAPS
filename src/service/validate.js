export const ValidateData = async (data)=>{
    return Object.keys(data).filter((key)=> !data[key]) // 
}