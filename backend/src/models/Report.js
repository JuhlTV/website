import mongoose from "mongoose";

const checkSchema = new mongoose.Schema(
  {
    itemKey: { type: String, required: true },
    itemLabel: { type: String, required: true },
    status: { type: String, enum: ["ok", "defekt"], required: true },
    commentText: { type: String, default: "" }
  },
  { _id: false }
);

const defectSchema = new mongoose.Schema(
  {
    itemKey: { type: String, required: true },
    itemLabel: { type: String, required: true },
    descriptionText: { type: String, required: true },
    priority: { type: String, enum: ["niedrig", "mittel", "kritisch"], required: true },
    timestamp: { type: Date, required: true },
    username: { type: String, required: true }
  },
  { _id: true }
);

const reportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true },
    vehicleKey: { type: String, required: true, index: true },
    vehicleName: { type: String, required: true },
    checks: { type: [checkSchema], default: [] },
    defects: { type: [defectSchema], default: [] }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false }
  }
);

export const Report = mongoose.model("Report", reportSchema);
