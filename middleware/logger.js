// middleware/logger.js
const Log = require("../models/ApiLogs");

const logger = async (req, res, next) => {
  const originalSend = res.send;

  // Intercept response body
  res.send = async function (body) {
    try {
      let success = false;
      let msg = "";
      let dataLength = 0;

      // Extract 'success', 'msg', and 'data.length' if the response body is JSON
      if (typeof body === "object") {
        const isBUffer = Buffer.isBuffer(body);
        success = body.success || (isBUffer ? true : false);
        msg =
          body.msg ||
          body.error ||
          (isBUffer ? "Document generated successfully" : "Error Occured while processing your request");
        dataLength = Array.isArray(body.data) ? body.data.length : null;
        console.log(isBUffer);
      } else {
        try {
          const parsedBody = JSON.parse(body);
          success = parsedBody.success || false;
          msg =
            parsedBody.msg ||
            parsedBody.msg ||
            parsedBody.error ||
            "Error Occured while processing your request";
          dataLength = Array.isArray(parsedBody.data)
            ? parsedBody.data.length
            : 0;
        } catch (error) {
          // Ignore parsing errors for non-JSON responses
        }
      }
      // Log the request body, including form-data
      // console.log("Request Body (Form Data or JSON):");
      // if (req.headers["content-type"]?.includes("multipart/form-data")) {
      //   console.log(req.body); // Log form-data fields
      //   console.log(req.files); // Log uploaded files if any
      // } else {
      //   console.log(req.body); // Log JSON or URL-encoded body
      // }

      // Save the log with only 'success' and 'msg' from the response body
      await Log.create({
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        requestBody: req.body || { file: "file" },
        responseBody: { success, msg, dataLength },
      });
    } catch (err) {
      console.error("Error saving log:", err);
    }

    // Call the original `res.send` method
    originalSend.call(this, body);
  };

  next();
};

module.exports = logger;
