import Ward from "../models/Ward.js";

export const createWard = async (req, res) => {
  try {
    const { name, number, area, city } = req.body;
    if (!name || !number)
      return res.status(400).json({ message: "Name and number required" });
    const exists = await Ward.findOne({ number });
    if (exists)
      return res.status(400).json({ message: "Ward number already exists" });
    const ward = await Ward.create({ name, number, area, city });
    res.status(201).json(ward);
  } catch (err) {
    res.status(500).json({ message: "Failed to create ward" });
  }
};

export const getWards = async (req, res) => {
  try {
    const wards = await Ward.find().sort({ number: 1 });
    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch wards" });
  }
};

export const deleteWard = async (req, res) => {
  try {
    await Ward.findByIdAndDelete(req.params.id);
    res.json({ message: "Ward deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete ward" });
  }
};
