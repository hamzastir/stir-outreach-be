import express from "express";
import { db } from "../db/db.js";

const router = express.Router();

router.get("/approved-users", async (req, res) => {
  try {
    // Fetch all users from stir_outreach_dashboard without pagination
    const users = await db("stir_outreach_dashboard").select("*");

    // Return all users
    res.status(200).json({
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/update-users", async (req, res) => {
  try {
    const users = req.body.users; // Expecting an array of user objects

    // Validate input
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "User data is required and should be an array." });
    }

    const newUsers = await db("stir_outreach_dashboard").insert(users).returning("*");

    res.status(201).json({ message: "Users added successfully", users: newUsers });
  } catch (error) {
    console.error("Error adding users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;