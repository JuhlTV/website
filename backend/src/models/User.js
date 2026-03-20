import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["benutzer", "geraetewart"],
      default: "benutzer",
      required: true
    }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false }
  }
);

export const User = mongoose.model("User", userSchema);
