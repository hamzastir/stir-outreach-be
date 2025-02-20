// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Path to the JSON file
const dataFilePath = path.join(__dirname, "calendly-open.json");

// Helper function to initialize the JSON file if it doesn't exist
async function initializeDataFile() {
  try {
    await fs.access(dataFilePath);
  } catch (error) {
    // File doesn't exist, create it with an empty array
    await fs.writeFile(dataFilePath, JSON.stringify([], null, 2));
  }
}

// Helper function to read the JSON file
async function readDataFile() {
  try {
    const data = await fs.readFile(dataFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.log(error);
    return [];
  }
}

// Helper function to write to the JSON file
async function writeDataFile(data) {
  await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
}

// Initialize the server
async function initializeServer() {
  try {
    await initializeDataFile();
    
    // Calendly API endpoint
    app.post("/api/calendly", async (req, res) => {
      try {
        const { name, email, calendly, time } = req.body;

        // Validate required fields
        if (!name || !email) {
          return res.status(400).json({ error: "Name and email are required" });
        }

        // Read existing data
        const existingData = await readDataFile();

        // Create new entry
        const newEntry = {
          name,
          email,
          calendly: calendly || true,
          time: time || new Date().toISOString(),
        };

        // Add new entry to existing data
        existingData.push(newEntry);

        // Write updated data back to file
        await writeDataFile(existingData);

        // Send success response
        res.status(200).json({
          message: "Data saved successfully",
          data: newEntry,
        });
      } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    const PORT = 3002;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

// Start the server
initializeServer();