// routes/dashboard.js
import express from "express";
import { db } from "../db/db.js";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";

const router = express.Router();

/**
 * GET /api/dashboard/raw-data
 * Get all raw data for frontend processing
 */
router.get("/raw-data", async (req, res) => {
  try {
    // Get all data from the last 6 months by default
    // Frontend will handle further filtering
    const from = format(subDays(new Date(), 180), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    
    const data = await db("stir_outreach_dashboard")
      .whereBetween("first_email_date", [from, to])
      .orderBy("first_email_date", "desc");
    
    res.json(data);
  } catch (error) {
    console.error("Error fetching raw dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

/**
 * GET /api/dashboard/pocs
 * Get list of POCs for filter dropdown
 */
router.get("/pocs", async (req, res) => {
  try {
    const pocs = await db("stir_outreach_dashboard")
      .distinct("poc")
      .whereNotNull("poc")
      .orderBy("poc");
    
    const pocOptions = [
      { value: "all", label: "All POCs" },
      ...pocs.map(p => ({ 
        value: p.poc.toLowerCase(), 
        label: p.poc 
      }))
    ];
    
    res.json(pocOptions);
  } catch (error) {
    console.error("Error fetching POCs:", error);
    res.status(500).json({ error: "Failed to fetch POCs" });
  }
});


router.get("/tiers", async (req, res) => {
  try {
 
    const tierOptions = [
      { value: "all", label: "All Tiers" },
      { value: "gold", label: "Gold" },
      { value: "silver", label: "Silver" },
      { value: "bronze", label: "Bronze" },
      { value: "micro", label: "Micro" },
    ];
    
    res.json(tierOptions);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    res.status(500).json({ error: "Failed to fetch tiers" });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      timeRange = "last7days",
      dateFrom,
      dateTo,
      poc = "all",
      tier = "all",
      chartTimeRange = "weekly",
      timeFilterFrom = "00:00",
      timeFilterTo = "23:59",
    } = req.query;

    // Calculate date range based on timeRange
    let from, to;
    const today = new Date();

    if (dateFrom && dateTo && timeRange === "custom") {
      from = startOfDay(parseISO(dateFrom));
      to = endOfDay(parseISO(dateTo));
    } else {
      switch (timeRange) {
        case "today":
          from = startOfDay(today);
          to = endOfDay(today);
          break;
        case "yesterday":
          from = startOfDay(subDays(today, 1));
          to = endOfDay(subDays(today, 1));
          break;
        case "last7days":
          from = startOfDay(subDays(today, 6));
          to = endOfDay(today);
          break;
        case "last30days":
          from = startOfDay(subDays(today, 29));
          to = endOfDay(today);
          break;
        case "thisMonth":
          from = startOfDay(startOfMonth(today));
          to = endOfDay(today);
          break;
        case "lastMonth":
          from = startOfDay(startOfMonth(subDays(startOfMonth(today), 1)));
          to = endOfDay(endOfMonth(subDays(startOfMonth(today), 1)));
          break;
        case "last3months":
          from = startOfDay(subDays(today, 90));
          to = endOfDay(today);
          break;
        case "last6months":
          from = startOfDay(subDays(today, 180));
          to = endOfDay(today);
          break;
        case "lastYear":
          from = startOfDay(subDays(today, 365));
          to = endOfDay(today);
          break;
        default:
          from = startOfDay(subDays(today, 6));
          to = endOfDay(today);
      }
    }

    res.json({
      dateRange: {
        from: format(from, "yyyy-MM-dd"),
        to: format(to, "yyyy-MM-dd"),
      },
      message: "Frontend now handles filtering and processing",
      status: "success",
    });
  } catch (error) {
    console.error("Error processing dashboard request:", error);
    res.status(500).json({ error: "Failed to process dashboard request" });
  }
});

export default router;