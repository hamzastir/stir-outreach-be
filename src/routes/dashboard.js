// routes/dashboard.js
import express from "express";
import { db } from "../db/db.js";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";

const router = express.Router();

/**
 * GET /api/dashboard
 * Get dashboard stats with filters
 */
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

    // Base query with date filtering
    let query = db("stir_outreach_dashboard")
      .whereBetween("first_email_date", [
        format(from, "yyyy-MM-dd"),
        format(to, "yyyy-MM-dd"),
      ]);

    // Apply POC filter
    if (poc !== "all") {
      query = query.where("poc", poc);
    }

    // Apply tier filter (assuming tier is stored in 'tier' column)
    // If tier is not directly available, you might need to adjust this part
    if (tier !== "all") {
      query = query.where("tier", tier);
    }

    // Get all filtered records
    const records = await query;

    // Calculate total stats
    const totalEmailsSent = records.length;
    const totalEmailsOpened = records.filter(record => record.email_opened).length;
    const totalReplies = records.filter(record => record.replied).length;
    const totalCalendlyClicked = records.filter(record => record.calendly_link_clicked).length;
    const totalVideoCallsScheduled = records.filter(record => record.video_call_date !== null).length;
    const totalVideoCallsCompleted = records.filter(record => 
      record.video_call_date !== null && record.video_call_status === 'completed'
    ).length;
    const totalOnboardingLinkClicked = records.filter(record => record.onboarding_link_clicked).length;
    const totalOnboardingStarted = records.filter(record => 
      record.onboarding_status && record.onboarding_status !== 'not_started'
    ).length;
    const totalOnboarded = records.filter(record => 
      record.onboarding_status === 'completed'
    ).length;
    const totalUnsubscribed = records.filter(record => record.unsubscribed).length;

    // Prepare time-series data based on chartTimeRange
    let timeSeriesData;
    
    switch (chartTimeRange) {
      case "hourly":
        timeSeriesData = await getHourlyData(from, to, timeFilterFrom, timeFilterTo, poc, tier);
        break;
      case "daily":
        timeSeriesData = await getDailyData(from, to, poc, tier);
        break;
      case "weekly":
        timeSeriesData = await getWeeklyData(from, to, poc, tier);
        break;
      case "monthly":
        timeSeriesData = await getMonthlyData(from, to, poc, tier);
        break;
      default:
        timeSeriesData = await getWeeklyData(from, to, poc, tier);
    }

    // Get recent activity
    const recentActivity = await getRecentActivity(20); // Last 20 activities

    // Return all data
    res.json({
      stats: {
        totalEmailsSent,
        totalEmailsOpened,
        totalReplies,
        totalCalendlyClicked,
        totalVideoCallsScheduled,
        totalVideoCallsCompleted,
        totalOnboardingLinkClicked,
        totalOnboardingStarted,
        totalOnboarded,
        totalUnsubscribed,
      },
      timeSeriesData,
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
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

/**
 * GET /api/dashboard/tiers
 * Get list of tiers (if tier column exists)
 */
router.get("/tiers", async (req, res) => {
  try {
    // If you have a tier column, use this:
    // const tiers = await db("stir_outreach_dashboard")
    //   .distinct("tier")
    //   .whereNotNull("tier")
    //   .orderBy("tier");
    
    // const tierOptions = [
    //   { value: "all", label: "All Tiers" },
    //   ...tiers.map(t => ({ 
    //     value: t.tier.toLowerCase(), 
    //     label: t.tier 
    //   }))
    // ];
    
    // If you don't have a tier column, return dummy data:
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

/**
 * Get hourly data for charts
 */
async function getHourlyData(from, to, timeFilterFrom, timeFilterTo, poc, tier) {
  // Generate hours array
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hour = `${String(i).padStart(2, '0')}:00`;
    if (hour >= timeFilterFrom && hour <= timeFilterTo) {
      hours.push(hour);
    }
  }

  // Initialize results with all hours
  const results = hours.map(hour => ({
    hour,
    emailsSent: 0,
    emailsOpened: 0,
    replies: 0,
    calendlyClicked: 0,
    videoCallsScheduled: 0,
    videoCallsCompleted: 0,
    onboardingLinkClicked: 0,
    onboardingStarted: 0,
    onboarded: 0,
    unsubscribed: 0,
  }));

  // Basic query for date range
  let query = db("stir_outreach_dashboard")
    .whereBetween("first_email_date", [
      format(from, "yyyy-MM-dd"),
      format(to, "yyyy-MM-dd"),
    ]);

  // Apply filters
  if (poc !== "all") {
    query = query.where("poc", poc);
  }
  if (tier !== "all") {
    query = query.where("tier", tier);
  }

  const records = await query;

  // Process records to aggregate by hour
  records.forEach(record => {
    if (record.first_email_time) {
      const hourStr = record.first_email_time.substring(0, 5);
      const hourIndex = hours.indexOf(hourStr);
      
      if (hourIndex >= 0) {
        results[hourIndex].emailsSent++;
        
        if (record.email_opened) {
          results[hourIndex].emailsOpened++;
        }
        
        if (record.replied) {
          results[hourIndex].replies++;
        }
        
        if (record.calendly_link_clicked) {
          results[hourIndex].calendlyClicked++;
        }
        
        if (record.video_call_date) {
          results[hourIndex].videoCallsScheduled++;
          
          if (record.video_call_status === 'completed') {
            results[hourIndex].videoCallsCompleted++;
          }
        }
        
        if (record.onboarding_link_clicked) {
          results[hourIndex].onboardingLinkClicked++;
        }
        
        if (record.onboarding_status && record.onboarding_status !== 'not_started') {
          results[hourIndex].onboardingStarted++;
          
          if (record.onboarding_status === 'completed') {
            results[hourIndex].onboarded++;
          }
        }
        
        if (record.unsubscribed) {
          results[hourIndex].unsubscribed++;
        }
      }
    }
  });

  return results;
}

/**
 * Get daily data for charts
 */
async function getDailyData(from, to, poc, tier) {
  const days = [];
  let currentDate = new Date(from);
  
  while (currentDate <= to) {
    days.push(format(currentDate, "yyyy-MM-dd"));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Initialize results with all days
  const results = days.map(day => ({
    day: format(parseISO(day), "MMM dd"),
    emailsSent: 0,
    emailsOpened: 0,
    replies: 0,
    calendlyClicked: 0,
    videoCallsScheduled: 0,
    videoCallsCompleted: 0,
    onboardingLinkClicked: 0,
    onboardingStarted: 0,
    onboarded: 0,
    unsubscribed: 0,
  }));

  // Query for aggregate data by day
  const emailsSentByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(first_email_date) as day, COUNT(*) as count"))
    .whereBetween("first_email_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const emailsOpenedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(email_open_date) as day, COUNT(*) as count"))
    .where("email_opened", true)
    .whereBetween("email_open_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const repliesByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(email_reply_date) as day, COUNT(*) as count"))
    .where("replied", true)
    .whereBetween("email_reply_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const calendlyClickedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(calendly_click_date) as day, COUNT(*) as count"))
    .where("calendly_link_clicked", true)
    .whereBetween("calendly_click_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const videoCallsByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(video_call_date) as day, COUNT(*) as count"))
    .whereNotNull("video_call_date")
    .whereBetween("video_call_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const videoCallsCompletedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(video_call_date) as day, COUNT(*) as count"))
    .whereNotNull("video_call_date")
    .where("video_call_status", "completed")
    .whereBetween("video_call_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const onboardingClickedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(onboarding_click_date) as day, COUNT(*) as count"))
    .where("onboarding_link_clicked", true)
    .whereBetween("onboarding_click_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const onboardingStartedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(onboarding_date) as day, COUNT(*) as count"))
    .whereNotNull("onboarding_date")
    .whereNot("onboarding_status", "not_started")
    .whereBetween("onboarding_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const onboardedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(onboarding_date) as day, COUNT(*) as count"))
    .where("onboarding_status", "completed")
    .whereBetween("onboarding_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  const unsubscribedByDay = await db("stir_outreach_dashboard")
    .select(db.raw("DATE(unsubscribe_date) as day, COUNT(*) as count"))
    .where("unsubscribed", true)
    .whereBetween("unsubscribe_date", [format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd")])
    .modify(query => {
      if (poc !== "all") query.where("poc", poc);
      if (tier !== "all") query.where("tier", tier);
    })
    .groupBy("day")
    .orderBy("day");

  // Populate results
  emailsSentByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].emailsSent = parseInt(item.count);
    }
  });

  emailsOpenedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].emailsOpened = parseInt(item.count);
    }
  });

  repliesByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].replies = parseInt(item.count);
    }
  });

  calendlyClickedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].calendlyClicked = parseInt(item.count);
    }
  });

  videoCallsByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].videoCallsScheduled = parseInt(item.count);
    }
  });

  videoCallsCompletedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].videoCallsCompleted = parseInt(item.count);
    }
  });

  onboardingClickedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].onboardingLinkClicked = parseInt(item.count);
    }
  });

  onboardingStartedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].onboardingStarted = parseInt(item.count);
    }
  });

  onboardedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].onboarded = parseInt(item.count);
    }
  });

  unsubscribedByDay.forEach(item => {
    const index = days.indexOf(item.day);
    if (index >= 0) {
      results[index].unsubscribed = parseInt(item.count);
    }
  });

  return results;
}

/**
 * Get weekly data for charts
 */
async function getWeeklyData(from, to, poc, tier) {
  // Generate weeks
  const weeklyData = [];
  let currentDate = new Date(from);
  let weekCounter = 1;

  while (currentDate <= to) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    if (weekEnd > to) {
      weekEnd.setTime(to.getTime());
    }

    const weekLabel = `Week ${weekCounter}`;
    weekCounter++;

    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    
    // Query for this week's data
    const weekData = await db("stir_outreach_dashboard")
      .whereBetween("first_email_date", [startStr, endStr])
      .modify(query => {
        if (poc !== "all") query.where("poc", poc);
        if (tier !== "all") query.where("tier", tier);
      });
    
    const emailsSent = weekData.length;
    const emailsOpened = weekData.filter(record => record.email_opened).length;
    const replies = weekData.filter(record => record.replied).length;
    const calendlyClicked = weekData.filter(record => record.calendly_link_clicked).length;
    const videoCallsScheduled = weekData.filter(record => record.video_call_date !== null).length;
    const videoCallsCompleted = weekData.filter(record => 
      record.video_call_date !== null && record.video_call_status === 'completed'
    ).length;
    const onboardingLinkClicked = weekData.filter(record => record.onboarding_link_clicked).length;
    const onboardingStarted = weekData.filter(record => 
      record.onboarding_status && record.onboarding_status !== 'not_started'
    ).length;
    const onboarded = weekData.filter(record => record.onboarding_status === 'completed').length;
    const unsubscribed = weekData.filter(record => record.unsubscribed).length;

    weeklyData.push({
      week: weekLabel,
      emailsSent,
      emailsOpened,
      replies,
      calendlyClicked,
      videoCallsScheduled,
      videoCallsCompleted,
      onboardingLinkClicked,
      onboardingStarted,
      onboarded,
      unsubscribed,
    });

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeklyData;
}

/**
 * Get monthly data for charts
 */
async function getMonthlyData(from, to, poc, tier) {
  const monthlyData = [];
  let currentDate = new Date(from);
  
  while (currentDate <= to) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    if (monthEnd > to) {
      monthEnd.setTime(to.getTime());
    }

    const monthLabel = format(monthStart, "MMM yyyy");
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");
    
    // Query for this month's data
    const monthData = await db("stir_outreach_dashboard")
      .whereBetween("first_email_date", [startStr, endStr])
      .modify(query => {
        if (poc !== "all") query.where("poc", poc);
        if (tier !== "all") query.where("tier", tier);
      });
    
    const emailsSent = monthData.length;
    const emailsOpened = monthData.filter(record => record.email_opened).length;
    const replies = monthData.filter(record => record.replied).length;
    const calendlyClicked = monthData.filter(record => record.calendly_link_clicked).length;
    const videoCallsScheduled = monthData.filter(record => record.video_call_date !== null).length;
    const videoCallsCompleted = monthData.filter(record => 
      record.video_call_date !== null && record.video_call_status === 'completed'
    ).length;
    const onboardingLinkClicked = monthData.filter(record => record.onboarding_link_clicked).length;
    const onboardingStarted = monthData.filter(record => 
      record.onboarding_status && record.onboarding_status !== 'not_started'
    ).length;
    const onboarded = monthData.filter(record => record.onboarding_status === 'completed').length;
    const unsubscribed = monthData.filter(record => record.unsubscribed).length;

    monthlyData.push({
      month: monthLabel,
      emailsSent,
      emailsOpened,
      replies,
      calendlyClicked,
      videoCallsScheduled,
      videoCallsCompleted,
      onboardingLinkClicked,
      onboardingStarted,
      onboarded,
      unsubscribed,
    });

    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return monthlyData;
}

/**
 * Get recent activity for activity feed
 */
async function getRecentActivity(limit = 20) {
  const activities = [];

  // Get recent emails
  const recentEmails = await db("stir_outreach_dashboard")
    .select("name", "business_email", "first_email_date", "first_email_time", "poc")
    .whereNotNull("first_email_date")
    .orderBy("first_email_date", "desc")
    .orderBy("first_email_time", "desc")
    .limit(limit);

  recentEmails.forEach(email => {
    activities.push({
      id: `email-${email.business_email}-${email.first_email_date}`,
      type: "email_sent",
      user: {
        name: email.name,
        email: email.business_email,
      },
      poc: email.poc,
      timestamp: `${email.first_email_date} ${email.first_email_time || "00:00:00"}`,
      message: `Email sent to ${email.name}`,
    });
  });

  // Get recent replies
  const recentReplies = await db("stir_outreach_dashboard")
    .select("name", "business_email", "email_reply_date", "email_reply_time", "poc", "reply_content")
    .where("replied", true)
    .whereNotNull("email_reply_date")
    .orderBy("email_reply_date", "desc")
    .orderBy("email_reply_time", "desc")
    .limit(limit);

  recentReplies.forEach(reply => {
    activities.push({
      id: `reply-${reply.business_email}-${reply.email_reply_date}`,
      type: "email_replied",
      user: {
        name: reply.name,
        email: reply.business_email,
      },
      poc: reply.poc,
      timestamp: `${reply.email_reply_date} ${reply.email_reply_time || "00:00:00"}`,
      message: `${reply.name} replied to email`,
      content: reply.reply_content,
    });
  });

  // Get recent video calls
  const recentVideoCalls = await db("stir_outreach_dashboard")
    .select("name", "business_email", "video_call_date", "poc", "video_call_status")
    .whereNotNull("video_call_date")
    .orderBy("video_call_date", "desc")
    .limit(limit);

  recentVideoCalls.forEach(call => {
    activities.push({
      id: `call-${call.business_email}-${call.video_call_date}`,
      type: "video_call",
      user: {
        name: call.name,
        email: call.business_email,
      },
      poc: call.poc,
      timestamp: call.video_call_date,
      message: `Video call ${call.video_call_status || "scheduled"} with ${call.name}`,
      status: call.video_call_status,
    });
  });

  // Get recent onboardings
  const recentOnboardings = await db("stir_outreach_dashboard")
    .select("name", "business_email", "onboarding_date", "poc", "onboarding_status")
    .whereNotNull("onboarding_date")
    .whereNot("onboarding_status", "not_started")
    .orderBy("onboarding_date", "desc")
    .limit(limit);

  recentOnboardings.forEach(onboarding => {
    activities.push({
      id: `onboarding-${onboarding.business_email}-${onboarding.onboarding_date}`,
      type: "onboarding",
      user: {
        name: onboarding.name,
        email: onboarding.business_email,
      },
      poc: onboarding.poc,
      timestamp: onboarding.onboarding_date,
      message: `${onboarding.name} ${onboarding.onboarding_status === 'completed' ? 'completed' : 'started'} onboarding`,
      status: onboarding.onboarding_status,
    });
  });

  // Get recent unsubscribes
  const recentUnsubscribes = await db("stir_outreach_dashboard")
    .select("name", "business_email", "unsubscribe_date", "poc", "unsubscribe_reason")
    .where("unsubscribed", true)
    .whereNotNull("unsubscribe_date")
    .orderBy("unsubscribe_date", "desc")
    .limit(limit);

  recentUnsubscribes.forEach(unsubscribe => {
    activities.push({
      id: `unsubscribe-${unsubscribe.business_email}-${unsubscribe.unsubscribe_date}`,
      type: "unsubscribe",
      user: {
        name: unsubscribe.name,
        email: unsubscribe.business_email,
      },
      poc: unsubscribe.poc,
      timestamp: unsubscribe.unsubscribe_date,
      message: `${unsubscribe.name} unsubscribed`,
      reason: unsubscribe.unsubscribe_reason,
    });
  });

  // Sort all activities by timestamp, most recent first
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export default router;