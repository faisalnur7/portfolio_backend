require("dotenv").config();
const mongoose = require("mongoose");
// Set strictQuery to true or false based on your needs
mongoose.set("strictQuery", true); // Suppress the warning

mongoose.set("bufferCommands", false); // Disables command buffering

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
    });
    console.log(`Mongo DB Connected on ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error in MongoDB Connection : ${error.message}`);
    process.exit(1);
  }
};
module.exports = connectDB;
