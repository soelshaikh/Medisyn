import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const CounterModel: mongoose.Model<{ _id: string; seq: number }> =
  mongoose.models["Counter"] ??
  mongoose.model("Counter", CounterSchema);

export async function nextUHID(): Promise<string> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: "uhid" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `MED-${String(doc!.seq).padStart(6, "0")}`;
}
