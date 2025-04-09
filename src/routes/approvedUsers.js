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
// Add this route to update a single user by ID
router.patch("/update-users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { notes, approved_leads_status } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    // Update the user with the specified ID
    const updatedUser = await db("stir_outreach_dashboard")
      .where({ id: userId })
      .update({ 
        notes: notes,
        approved_leads_status: approved_leads_status
      })
      .returning("*");

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ 
      message: "User updated successfully", 
      user: updatedUser[0]
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Keep the existing post endpoint for backward compatibility
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

// Add this to your existing dashboardAPI.js router

router.delete("/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    // Delete the user with the specified email
    const deletedCount = await db("stir_outreach_dashboard")
      .where({ business_email: email })
      .del();
    
    if (deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.status(200).json({ 
      message: "User deleted successfully", 
      email: email,
      deletedCount: deletedCount 
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;