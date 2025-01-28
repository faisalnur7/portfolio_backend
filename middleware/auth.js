const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require('./async');

exports.protect = asyncHandler(async(req,res,next)=>{
    let token = null;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }
    else{
        return next(new ErrorResponse('Unauthorized user',401));
    }

    if(!token || token === null){
        return next(new ErrorResponse('Unauthorized user',401));
    }

    try {
        //verify token
        const decoded = jwt.verify(token,process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } catch (error) {
        
        return next(new ErrorResponse('Unauthorized user',401));

    }

});

//access for specific role
exports.authorize = (...roles) =>{
    return (req,res,next) => {
        if(!roles.includes(req.user.role)){
            return next(new ErrorResponse(`Role : ${req.user.role} - is not authorized to access`,403));

        }
        next();
    }
}