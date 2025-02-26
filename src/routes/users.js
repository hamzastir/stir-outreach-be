import express from "express";
import { db } from "../db/db.js";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    // Get page and limit from query parameters, with default values
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page

    // Calculate the offset based on page and limit
    const offset = (page - 1) * limit;

    // Fetch paginated data from stir_outreach_dashboard
    const users = await db("stir_outreach_dashboard")
      .select("*") // You can specify columns if you only need certain fields
      .limit(limit)  // Limit the number of records per page
      .offset(offset); // Skip the appropriate number of records based on the current page

    // Fetch the total count of users (to calculate the total number of pages)
    const totalCountResult = await db("stir_outreach_dashboard").count("id as total_count").first(); // Assuming 'id' is the primary key of the table

    const totalCount = totalCountResult.total_count;
    const totalPages = Math.ceil(totalCount / limit); // Calculate total pages

    // Return the paginated response with count and total pages
    res.status(200).json({
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
