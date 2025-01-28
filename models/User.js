const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      minlength: [4, "Name cant be less than 5 char"],
    },
    imagePath: {
      type: String,
    },

    email: {
      type: String,
      unique: true,
    //   required: [true, "Please add a valid email"],
    //   match: [
    //     /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
    //     "Please add a valid email",
    //   ],
    },
    role: {
      type: String,
      // enum: ["user", "admin"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
    //   minlength: 6,
    //   select: false,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isMsadUser: {
      type: Boolean,
      default: false
    },
    uuid:{
      type: String
    }
  },
  { timestamps: true }
);

//encrypt pass
userSchema.pre("save", async function (next) {
  //only run when changed
  if (!this.isModified("password")) {
    next();
  }
  //else encrypt
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

//compare password
// userSchema.methods.matchPassword = async function (plainPass) {
//   return await bcrypt.compare(plainPass, this.password);
// };

userSchema.methods.matchPassword = async function (plainPass) {
  if (!this.password) {
    throw new Error("Password is not set for this user");
  }

  try {
    return await bcrypt.compare(plainPass, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};


//sign JWT
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRED_IN,
  });
};

module.exports = User = mongoose.model("User", userSchema);
