const { StatusCodes } = require('http-status-codes');


const sendSuccessResponseData = (res,message, data = {}) => {
    return res.status(StatusCodes.CREATED).json({
      success:true,
      message,
      data: { ...data }
    });
};


const sendSuccessResponse = (res,message) => {
    return res.status(StatusCodes.CREATED).json({
      success:true,
      message,
    });
};


const sendBadRequestResponse = (res,message) => {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success:false,
      message,
    });
};

const sendConflictResponse = (res,message) => {
    return res.status(StatusCodes.CONFLICT).json({
      success:false,
      message,
    });
};

const sendInternalServerErrorResponse = (res,message) => {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success:false,
      message,
    });
};


const sendUnauthenticatedErrorResponse = (res,message) => {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success:false,
      message,
    });
};
 
  

module.exports={
   sendBadRequestResponse,
   sendInternalServerErrorResponse,
   sendSuccessResponse,
   sendSuccessResponseData,
   sendUnauthenticatedErrorResponse,
   sendConflictResponse
}