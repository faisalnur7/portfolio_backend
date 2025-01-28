const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const userController = require("../controller/userController");
const router = express.Router();

router.post("/create-admin", userController.createAdmin);

// router.route("/").post(createUser);
router.route("/login").post(userController.authUser);
router.put("/update-admin-password", userController.updateAdminPassword);

// Route to POST/upload a user
router.post("/create-user", protect, userController.createNewUser);
router.post("/update-user-profile", protect, userController.updateUserDetails);
router.post("/get-user-profile", protect, userController.getUserProfile);
router.get("/", protect, userController.getAllUsers);
// DELETE a document by ID
router.delete("/delete", protect, userController.deleteUser);

// MS active directory user operations route
router.get("/azure_users", protect, userController.getAllAzureUsers);
router.get("/azure_roles", protect, userController.getAllAzureRoles);
router.get("/azure_user/:userId/roles", protect, userController.getUserAzureRoles);
router.post("/sync_azure_users", protect, userController.syncAllAzureUsers);
router.post("/loginAzureUser", userController.loginAzureUser);

// get all microsoft active directory users from users collection
router.get("/get_all_msad_users", protect, userController.getAllMsadUsers);

// update user by id
router.put("/:userId/update", protect, userController.updateUser);

// delete user by id (soft delete)
router.put("/:userId/delete", protect, userController.deleteUserById);

// undo delete user by id (soft delete)
router.put("/:userId/undo_delete", protect, userController.undoDeleteUserById);

// delete user by id (hard delete)
router.delete("/:userId/hard_delete", protect, userController.hardDeleteUser);

module.exports = router;
