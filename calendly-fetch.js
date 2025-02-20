import express from "express";
import cors from "cors";
import { db } from "../db/db.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

async function initializeServer() {
  try {
    app.post("/api/calendly", async (req, res) => {
      try {
        const { name, email, calendly, time } = req.body;

        // Validate required fields
        if (!name || !email) {
          return res.status(400).json({ error: "Name and email are required" });
        }

        // Update the database
        try {
          const updateResult = await db("stir_outreach_dashboard")
            .where("business_email", email)
            .update({
              calendly_link_clicked: true,
              calendly_click_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
              calendly_click_time: new Date().toISOString().split('T')[1].split('.')[0] // HH:MM:SS
            });

          if (updateResult === 0) {
            return res.status(404).json({ 
              error: "No matching record found with the provided email" 
            });
          }

          // Fetch the updated record
          const updatedRecord = await db("stir_outreach_dashboard")
            .select("user_id", "username", "name", "business_email", "calendly_link_clicked", "calendly_click_date", "calendly_click_time")
            .where("business_email", email)
            .first();

          res.status(200).json({
            message: "Data updated successfully",
            data: updatedRecord
          });

        } catch (dbError) {
          console.error("Database error:", dbError);
          return res.status(500).json({ 
            error: "Database error occurred",
            details: dbError.message 
          });
        }

      } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

initializeServer();