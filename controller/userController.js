const { format } = require("date-fns");
const multer = require("multer");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const checkCollection = require("../utils/checkCollectionExists");
const asyncHandler = require("../middleware/async");
const path = require("path");
const bcrypt = require("bcryptjs");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const { MongoClient } = require('mongodb');
const microsoft_ad = require("../models/MS_AD");
const validateAzureCredentialsFromDb = require('../utils/validateAzureCredentialsFromDb');
let cca;
const fetchMS_ADData = async () => {
  try {
    const testExists = await checkCollection('test','microsoft_ads', process.env.MONGO_URI);

    if(!testExists){
      return false;
    }
    const getMS_AD_settings = await microsoft_ad.findOne({ isActive: true });
    if (!getMS_AD_settings) {
      return false;
    }

    if(!getMS_AD_settings.client_id || !getMS_AD_settings.app_secret){
      return false;
    }
    return {
      auth: {
        clientId: getMS_AD_settings.client_id,
        authority: `https://login.microsoftonline.com/${getMS_AD_settings.azure_tenant}`,
        clientSecret: getMS_AD_settings.app_secret,
      },
    };
  } catch (error) {
    console.error("Error fetching MS AD data:", error);
    throw error;
  }
};

const checkCredentials = async () =>{
  const isValidAzure = await validateAzureCredentialsFromDb(process.env.MONGO_URI,'test','microsoft_ads',{});
  if (!isValidAzure) {
    return false;
  }
  return true;
}

const initializeAzureConfig = async () => {
  try {
    const azure_config = await fetchMS_ADData(); // Fetch MS AD settings
    if (!azure_config) {
      return;
    }
    cca = new ConfidentialClientApplication(azure_config);
  } catch (error) {
    console.error("Error initializing Azure config:", error);
  }
};

// Call the function to initialize the Azure configuration
initializeAzureConfig();

//@desc     create user
//@route    POST    /api/users
//@access   private
exports.createUser = asyncHandler(async (req, res, next) => {
  const isExist = await User.findOne({ email: req.body.email });
  if (isExist) {
    return next(new ErrorResponse("User Already Exist", 400));
  }
  const user = await User.create(req.body);
  if (user) {
    return res.status(201).json({
      success: true,
      data: user,
      token: user.getSignedJwtToken(),
    });
  } else {
    return next(new ErrorResponse("Invalid Data", 400));
  }
});

//@desc     get profile
//@route    GET     /api/users/profile
//@access   private
exports.getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }
  return res.status(200).json({
    success: true,
    data: user,
  });
});

//@desc     get auth user
//@route    POST     /api/users/login
//@access   public
exports.authUser = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user.isActive) {
    return next(new ErrorResponse(`No account found.`, 401));
  }

  const isMatched = await bcrypt.compare(
    req.body.password.toString(),
    user.password.toString()
  );
  // return res.json({req: req.body.password.toString(), user: user.password, isMatched : isMatched});

  if (user && isMatched) {
    return res.status(200).json({
      success: true,
      msg: "User logged in successfully!",
      data: user,
      token: user.getSignedJwtToken(),
    });
  } else {
    return next(new ErrorResponse(`Invalid email or password`, 401));
  }
});

//@desc     get all users
//@route    GET /api/users
//@access   public
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const { isMsadUser, isActive, search } = req.query;

  // Build the query object dynamically
  const query = {};

  if (isMsadUser) {
    query.isMsadUser = isMsadUser == "Azure";
  }
  if (isActive) {
    query.isActive = isActive == "Active";
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } }, // Case-insensitive match for name
      { email: { $regex: search, $options: "i" } }, // Case-insensitive match for email
    ];
  }
  const users = await User.find(query).sort({ timestamp: -1 });
  if (!users) {
    return next(new ErrorResponse("No Users Found!", 404));
  }
  return res.status(200).json({
    success: true,
    msg: "Users fetched successfully!",
    data: users,
  });
});
// by Banna
exports.getUserProfile = asyncHandler(async (req, res, next) => {
  const { password, email } = req.body;

  // Build query dynamically based on provided filters
  const query = {};
  if (email) query.email = email; // Exact match for email
  if (password) query.password = password; // Exact match for password

  const users = await User.find(query);
  if (!users || users.length === 0) {
    return next(new ErrorResponse("No Users Found!", 404));
  }

  return res.status(200).json({
    success: true,
    msg: "Users fetched successfully!",
    data: users,
  });
});
// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save to 'uploads' folder
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File Filter (optional, to accept only specific file types)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|docx|txt|jpg|jpeg|png/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  if (extname) {
    cb(null, true);
  } else {
    cb(new ErrorResponse("Only documents and images are allowed!", 400), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});
// Create user API
exports.createNewUser = asyncHandler(async (req, res, next) => {
  console.log(req.body);
  const isExist = await User.findOne({ email: req.body.email });
  if (isExist) {
    return next(new ErrorResponse("User Already Exist", 400));
  }
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return next(new ErrorResponse(err.message, 400));
    }

    // if (!req.file && !req.body.id) {
    //   return next(
    //     new ErrorResponse("Please upload a file or provide an ID", 400)
    //   );
    // }

    const { name, email, password, role } = req.body;

    try {
      // Create a new document
      // if (!req.file) {
      //   return next(new ErrorResponse("Please upload a file", 400));
      // }

      doc = await User.create({
        name,
        email,
        password,
        role,
        imagePath: req.file?.path || "",
      });

      return res.status(201).json({
        success: true,
        msg: "Document uploaded successfully!",
        data: doc,
      });
    } catch (error) {
      return next(new ErrorResponse(error.message, 500));
    }
  });
});
// Update user API
exports.updateUserDetails = asyncHandler(async (req, res, next) => {
  const { userId } = req.query;

  // Check if user exists
  const user = await User.findById(userId);
  console.log({ userId }, user);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  upload.single("file")(req, res, async (err) => {
    if (err) {
      return next(new ErrorResponse(err.message, 400));
    }

    const { name, email, password, role, isActive, _id } = req.body;
    try {
      // Hash the new password if provided
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        req.body.password = hashedPassword;
      }
      const payload = {
        name,
        email,
        password: req.body.password,
        role,
        isActive,
        imagePath: req.file?.path || user.imagePath,
      };
      if (!password) {
        delete payload.password;
      }
      // Update the user with the provided data
      const updatedUser = await User.findByIdAndUpdate(_id, payload, {
        new: true,
      });

      return res.status(200).json({
        success: true,
        msg: "User updated successfully!",
        data: updatedUser,
      });
    } catch (error) {
      return next(new ErrorResponse(error.message, 500));
    }
  });
});
// DELETE Document by ID
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.body;

  // Validate if id is provided
  if (!id) {
    return next(new ErrorResponse("Document ID is required", 400));
  }

  // Find and delete the document by ID
  const deletedDoc = await User.findByIdAndDelete(id);

  if (!deletedDoc) {
    return next(new ErrorResponse(`No document found with ID: ${id}`, 404));
  }

  return res.status(200).json({
    success: true,
    msg: "Document deleted successfully!",
    data: deletedDoc,
  });
});

// Faisal Nur : Azure code starts
// Faisal Nur : Function to get an access token
async function getAccessToken() {
  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  try {
    const testExists = await checkCollection('test','microsoft_ads', process.env.MONGO_URI);

    if(!testExists){
      return false;
    }
    
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    return response.accessToken;
  } catch (error) {
    console.error("Error acquiring token:", error);
    throw error;
  }
}

// Function to initialize Client with Access token
async function getGraphClient() {
  const accessToken = await getAccessToken();
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// @desc    Get all microsoft active directory users
// @route   GET /api/users/azure_users
// @access  public
exports.getAllAzureUsers = asyncHandler(async (req, res) => {
  try {
    // Call the Azure credential validation function
    if (!await checkCredentials()) {
      console.log('Azure credentials mismatched.');
      return res.status(401).json({ error: 'Azure credentials mismatched' });
    }
    const client = await getGraphClient();
    const users = await client.api("/users").get();
    res.json(users.value);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// @desc    Get all microsoft active directory user roles
// @route   GET /api/users/azure_roles
// @access  public
exports.getAllAzureRoles = asyncHandler(async (req, res) => {
  try {
    // Call the Azure credential validation function
    if (!await checkCredentials()) {
      console.log('Azure credentials mismatched.');
      return res.status(401).json({ error: 'Azure credentials mismatched' });
    }
    const client = await getGraphClient();
    const groups = await client.api("/groups").get();
    res.json(groups.value);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Error fetching roles" });
  }
});

// @desc    Get microsoft active directory user roles by ID
// @route   GET /api/users/azure_user/<userId>/roles
// @access  public
exports.getUserAzureRoles = asyncHandler(async (req, res) => {
  // Call the Azure credential validation function
  if (!await checkCredentials()) {
    console.log('Azure credentials mismatched.');
    return res.status(401).json({ error: 'Azure credentials mismatched' });
  }
  const userId = req.params.userId;
  try {
    const client = await getGraphClient();
    const groups = await client.api(`/users/${userId}/memberOf`).get();
    res.json(groups.value);
  } catch (error) {
    console.error(`Error fetching roles for user ${userId}:`, error);
    res.status(500).json({ error: `Error fetching roles for user ${userId}` });
  }
});

// @desc    sync microsoft active directory users and insert to users collection
// @route   GET /api/users/azure_users
// @access  public
exports.syncAllAzureUsers = asyncHandler(async (req, res) => {
  try {
    const testExists = await checkCollection('test','microsoft_ads', process.env.MONGO_URI);

    if(!testExists){
      return res.status(500).json({ error: "MS AD settings not found." });
    }

    // Call the Azure credential validation function
    if (!await checkCredentials()) {
      console.log('Azure credentials mismatched.');
      return res.status(401).json({ error: 'Azure credentials mismatched' });
    }
    console.log("Fetching users from Azure...");
    const client = await getGraphClient();
    const { value: azureUsers } = await client.api("/users").get(); // Fetch users from Azure

    if (!azureUsers) {
      console.log("No users found in Azure.");
      return res.status(500).json({ error: "No users found in Azure" });
    }

    const newUsers = [];
    for (const azureUser of azureUsers) {
      // Check if user exists in MongoDB by Azure user ID
      const existingUser = await User.findOne({ uuid: azureUser.id });
      const existingUserByEmail = await User.findOne({ email: azureUser.mail || azureUser.userPrincipalName });
      if (existingUserByEmail) {
        continue;
      }

      if (!existingUser) {
        console.log(`Creating new user: ${azureUser.displayName}`);
        // If user doesn't exist, insert into MongoDB
        const newUser = await User.create({
          uuid: azureUser.id,
          name: azureUser.displayName,
          email: azureUser.mail || azureUser.userPrincipalName,
          password: "password",  // Ensure this is handled securely in production
          isActive: true,
          isMsadUser: true,
        });
        newUsers.push(newUser);
      } else {
        console.log(`User already exists: ${azureUser.displayName}`);
      }
    }

    const getMS_AD_settings = await microsoft_ad.findOne({ isActivate: true });

    if (!getMS_AD_settings) {
      console.log("MS AD settings not found.");
      return res.status(500).json({ error: "MS AD settings not found." });
    }

    // Ensure the timestamp is valid
    const timestamp = Date.now();
    const formatted = format(timestamp, "yyyy-MM-dd HH:mm:ss");

    // Update the last_synchronization field
    const updateResult = await microsoft_ad.updateOne(
      { _id: getMS_AD_settings._id },  // Filter by document ID
      { $set: { last_synchronization: formatted } }  // Set the new value for last_synchronization
    );

    if (updateResult.modifiedCount === 0) {
      console.log("Failed to update last synchronization time.");
    } else {
      console.log("Last synchronization time updated successfully.");
    }

    const allUsers = await User.find({});
    console.log(`User sync completed. New users added: ${newUsers.length}`);

    res.json({
      message: "User sync completed",
      newUsersCount: newUsers.length,
      allUsers: allUsers,
    });
  } catch (error) {
    console.error("Error during user sync:", error);
    res.status(500).json({ error: "Error fetching or syncing users" });
  }
});

// Azure code ends

// Faisal Nur : User collection operations start

// Create Admin if no admin account exists
exports.createAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  // Check if all fields are provided
  if (!name || !email || !password) {
    return res.status(400).json({
      error: "name, email, and password are required.",
      data: req.body,
    });
  }

  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      return res.status(403).json({ error: "An admin user already exists." });
    }
    const adminUser = new User({
      name: name,
      email,
      password,
      role: "admin",
      imagePath: null,
    });

    await adminUser.save();
    res.status(201).json({
      message: "Admin user created successfully.",
      userId: adminUser._id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create admin user.", details: error.message });
  }
};

// Update admin password
exports.updateAdminPassword = asyncHandler(async (req, res, next) => {
  const { email, newPassword, id } = req.body;

  if (!email || !newPassword) {
    return next(
      new ErrorResponse("Please provide email and new password", 400)
    );
  }

  const admin = await User.findOne({ email, _id: id });

  if (!admin) {
    return next(new ErrorResponse("Admin user not found", 404));
  }

  // Update the admin password
  admin.password = newPassword;
  await admin.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});

// @desc    get all microsoft active directory users from users collection
// @route   GET /api/users/get_all_msad_users
// @access  public
exports.getAllMsadUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find({ isActive: true, isMsadUser: true }).sort({
    timestamp: -1,
  });
  if (!users) {
    return next(new ErrorResponse("No Users Found!", 404));
  }
  return res.status(200).json({
    success: true,
    msg: "Microsoft Active Directory Users fetched successfully!",
    data: users,
  });
});

// @desc    update user by id
// @route   PUT /api/users/<user_id>/update
// @access  public
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Hash the new password
  if (req.body.password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    req.body.password = hashedPassword;
  }

  let user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Update the user with the provided data
  user = await User.findByIdAndUpdate(userId, req.body, {
    new: true,
  });

  // Respond with the updated user
  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    delete user by id (soft delete)
// @route   PUT /api/users/<user_id>/delete
// @access  public
exports.deleteUserById = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    return next(new ErrorResponse("User not found", 404));
  }

  user.isActive = false;
  await user.save();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
    data: user,
  });
});

// @desc    undo delete user by id (soft delete)
// @route   PUT /api/users/<user_id>/undo_delete
// @access  public
exports.undoDeleteUserById = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  user.isActive = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: "User restored successfully",
    data: user,
  });
});

// @desc    delete user by id (hard delete)
// @route   PUT /api/users/<user_id>/hard_delete
// @access  public
exports.hardDeleteUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findByIdAndDelete(userId);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "User permanently deleted",
    data: user,
  });
});


exports.loginAzureUser = asyncHandler(async (req, res, next) => {

  const account = req.body.loginResponse.account;
  let user = await User.findOne({ email: account.username });

  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password', salt);

    const userData = {
      name: account.name,
      email: account.username,
      isActive: true,
      isMsadUser: true,
      password: hashedPassword,
    }

    user = await User.create( userData );
  }

  if (user) {
    return res.status(200).json({
      success: true,
      msg: "User logged in successfully!",
      data: user,
      token: user.getSignedJwtToken(),
    });
  } else {
    return next(new ErrorResponse(`Unauthorized login`, 401));
  }

});