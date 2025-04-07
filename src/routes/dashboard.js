// routes/dashboard.js
import express from "express";
import { db } from "../db/db.js";
import { 
  format,  
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  eachHourOfInterval,
  isWithinInterval,
  subMonths,
  isAfter
} from "date-fns";

const router = express.Router();  

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics based on time filters
 */
router.get("/stats", async (req, res) => {
  try {
    const { 
      timeRange = "last7days", 
      dateFrom, 
      dateTo, 
      poc = "all",
      granularity
    } = req.query;
    
    // Get all users data
    let query = db("stir_outreach_dashboard");
    
    // Apply POC filter if specified
    if (poc !== "all") {
      query = query.where("poc", poc);
    }
    
    const users = await query;
    
    // If no users found, return empty result
    if (users.length === 0) {
      return res.json({
        dateRange: { from: "", to: "" },
        stats: {
          totalEmails: 0,
          totalDelivered: 0,
          totalBounced: 0,
          totalReplies: 0,
          totalCalendlyClicks: 0,
          totalOnboardingClicks: 0,
          totalVideoCallsScheduled: 0,
          totalOnboardingsCompleted: 0,
          totalUnsubscribes: 0,
          // Add detailed follow-up metrics
          totalFollowUps: {
            followUp1: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            followUp2: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            followUp3: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            onboardingFollowUp1: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            onboardingFollowUp2: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            calendlyFollowUp1: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            },
            calendlyFollowUp2: {
              sent: 0,
              replied: 0,
              onboardingClicked: 0,
              calendlyClicked: 0,
              unsubscribed: 0
            }
          },
          replyRate: 0,
          bounceRate: 0,
          calendlyClickRate: 0,
          onboardingClickRate: 0
        },
        chartData: [],
        recentActivity: [],
        status: "success"
      });
    }
    
    // Determine date range based on timeRange
    let fromDate, toDate;
    const now = new Date();
    
    switch (timeRange) {
      case "today":
        fromDate = startOfDay(now);
        toDate = endOfDay(now);
        break;
        
      case "yesterday":
        fromDate = startOfDay(subDays(now, 1));
        toDate = endOfDay(subDays(now, 1));
        break;
        
      case "last7days":
        fromDate = startOfDay(subDays(now, 6));
        toDate = endOfDay(now);
        break;
        
      case "last30days":
        fromDate = startOfDay(subDays(now, 29));
        toDate = endOfDay(now);
        break;
        
      case "thisMonth":
        fromDate = startOfMonth(now);
        toDate = endOfDay(now);
        break;
        
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
        
      case "last3months":
        fromDate = startOfDay(subMonths(now, 3));
        toDate = endOfDay(now);
        break;
        
      case "last6months":
        fromDate = startOfDay(subMonths(now, 6));
        toDate = endOfDay(now);
        break;
        
      case "lastYear":
        fromDate = startOfDay(subMonths(now, 12));
        toDate = endOfDay(now);
        break;
        
      case "custom":
        if (dateFrom && dateTo) {
          fromDate = startOfDay(new Date(dateFrom));
          toDate = endOfDay(new Date(dateTo));
        } else {
          fromDate = startOfDay(subDays(now, 6));
          toDate = endOfDay(now);
        }
        break;
        
      default:
        fromDate = startOfDay(subDays(now, 6));
        toDate = endOfDay(now);
    }
    
    // Helper function to parse date and time strings
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr) return null;
      
      try {
        let date;
        
        // Check if dateStr is already a Date object
        if (dateStr instanceof Date) {
          date = dateStr;
        } 
        // Check if it's a string with the 'T' character (ISO format)
        else if (typeof dateStr === 'string' && dateStr.includes('T')) {
          date = new Date(dateStr);
        } 
        // Regular date string (YYYY-MM-DD)
        else if (typeof dateStr === 'string') {
          // Split date string into components
          const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
          
          if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
          
          date = new Date(year, month - 1, day);
        }
        // If it's neither a Date nor a string, return null
        else {
          return null;
        }
        
        // Add time if provided
        if (timeStr && typeof timeStr === 'string') {
          const timeParts = timeStr.split(':');
          if (timeParts.length >= 2) {
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            const second = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
            
            if (!isNaN(hour) && !isNaN(minute) && !isNaN(second)) {
              date.setHours(hour, minute, second);
            }
          }
        }
        
        return date;
      } catch (err) {
        console.warn(`Error parsing date: ${dateStr} ${timeStr}`, err);
        return null;
      }
    };
    
    // Initialize statistics
    const stats = {
      totalEmails: 0,            // This will count both scheduled + sent (first_email_status)
      totalDelivered: 0,         // This will count only sent (first_email_status = 'sent')
      totalBounced: 0,           // This will count emails marked as bounced
      totalReplies: 0,
      totalCalendlyClicks: 0,
      totalOnboardingClicks: 0,
      totalVideoCallsScheduled: 0,
      totalOnboardingsCompleted: 0,
      totalUnsubscribes: 0,
      // Add detailed follow-up metrics
      totalFollowUps: {
        followUp1: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        followUp2: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        followUp3: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        onboardingFollowUp1: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        onboardingFollowUp2: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        calendlyFollowUp1: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        },
        calendlyFollowUp2: {
          sent: 0,
          replied: 0,
          onboardingClicked: 0,
          calendlyClicked: 0,
          unsubscribed: 0
        }
      }
    };
    
    // Initialize recent activity array
    const recentActivity = [];
    
    // Use hourly granularity for today and yesterday
    if ((timeRange === 'today' || timeRange === 'yesterday') && granularity === 'hourly') {
      // Generate hourly intervals
      const chartInterval = eachHourOfInterval({ start: fromDate, end: toDate });
      
      // Initialize hourly chart data with all 24 hours
      const chartData = chartInterval.map(hour => {
        return {
          date: format(hour, "yyyy-MM-dd'T'HH:00:00"),
          hour: format(hour, "HH:00"),
          emailsSent: 0,
          emailsDelivered: 0,
          emailsBounced: 0,
          repliesReceived: 0,
          calendlyClicks: 0,
          onboardingClicks: 0,
          videoCallsScheduled: 0,
          onboardingsCompleted: 0,
          // Add follow-up tracking
          followUp1Sent: 0,
          followUp2Sent: 0,
          followUp3Sent: 0,
          onboardingFollowUp1Sent: 0,
          onboardingFollowUp2Sent: 0,
          calendlyFollowUp1Sent: 0,
          calendlyFollowUp2Sent: 0
        };
      });
      
      // Process each user's data
      users.forEach(user => {
        // Store dates for later comparison
        const followUpDates = {
          followUp1: parseDateTime(user.follow_up_1_date, user.follow_up_1_time),
          followUp2: parseDateTime(user.follow_up_2_date, user.follow_up_2_time),
          followUp3: parseDateTime(user.follow_up_3_date, user.follow_up_3_time),
          onboardingFollowUp1: parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time),
          onboardingFollowUp2: parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time),
          calendlyFollowUp1: parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time),
          calendlyFollowUp2: parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time)
        };
        
        const replyDate = user.replied ? parseDateTime(user.email_reply_date, user.email_reply_time) : null;
        const onboardingClickDate = user.onboarding_link_clicked ? parseDateTime(user.onboarding_click_date, user.onboarding_click_time) : null;
        const calendlyClickDate = user.calendly_link_clicked ? parseDateTime(user.calendly_click_date, user.calendly_click_time) : null;
        const unsubscribeDate = user.unsubscribed ? parseDateTime(user.unsubscribe_date, null) : null;
        
        // Process email sent (both scheduled + sent)
        if (user.first_email_date && (user.first_email_status === 'sent' || user.first_email_status === 'scheduled')) {
          const emailDate = parseDateTime(user.first_email_date, user.first_email_time);
          
          if (emailDate && isWithinInterval(emailDate, { start: fromDate, end: toDate })) {
            stats.totalEmails++;
            
            // Count as delivered only if status is 'sent' and not bounced
            if (user.first_email_status === 'sent') {
              if (user.is_bounced) {
                stats.totalBounced++;
              } else {
                stats.totalDelivered++;
              }
            }
            
            // Add to hourly chart data
            const hour = emailDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].emailsSent++;
              if (user.first_email_status === 'sent') {
                if (user.is_bounced) {
                  chartData[hourIndex].emailsBounced++;
                } else {
                  chartData[hourIndex].emailsDelivered++;
                }
              }
            }
            
            // Add to recent activity
            recentActivity.push({
              id: user.id,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: user.is_bounced ? 'email_bounced' : 'email_sent',
              activityDate: user.first_email_date,
              activityTime: user.first_email_time,
              timestamp: emailDate
            });
          }
        }
        
        // Process follow-up emails
        
        // Follow-up 1
        if (user.follow_up_1_date && user.follow_up_1_status) {
          const followUpDate = followUpDates.followUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp1.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].followUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_1_sent',
              activityDate: user.follow_up_1_date,
              activityTime: user.follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp1.unsubscribed++;
          }
        }
        
        // Follow-up 2
        if (user.follow_up_2_date && user.follow_up_2_status) {
          const followUpDate = followUpDates.followUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp2.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].followUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_2_sent',
              activityDate: user.follow_up_2_date,
              activityTime: user.follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp2.unsubscribed++;
          }
        }
        
        // Follow-up 3
        if (user.follow_up_3_date && user.follow_up_3_status) {
          const followUpDate = followUpDates.followUp3;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp3.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].followUp3Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_3_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_3_sent',
              activityDate: user.follow_up_3_date,
              activityTime: user.follow_up_3_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp3.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp3.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp3.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp3.unsubscribed++;
          }
        }
        
        // Onboarding Follow-up 1
        if (user.onboarding_follow_up_1_date && user.onboarding_follow_up_1_status) {
          const followUpDate = followUpDates.onboardingFollowUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp1.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].onboardingFollowUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_1_sent',
              activityDate: user.onboarding_follow_up_1_date,
              activityTime: user.onboarding_follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.unsubscribed++;
          }
        }
        
        // Onboarding Follow-up 2
        if (user.onboarding_follow_up_2_date && user.onboarding_follow_up_2_status) {
          const followUpDate = followUpDates.onboardingFollowUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp2.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].onboardingFollowUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_2_sent',
              activityDate: user.onboarding_follow_up_2_date,
              activityTime: user.onboarding_follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.unsubscribed++;
          }
        }
        
        // Calendly Follow-up 1
        if (user.calendly_follow_up_1_date && user.calendly_follow_up_1_status) {
          const followUpDate = followUpDates.calendlyFollowUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp1.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].calendlyFollowUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_1_sent',
              activityDate: user.calendly_follow_up_1_date,
              activityTime: user.calendly_follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.unsubscribed++;
          }
        }
        
        // Calendly Follow-up 2
        if (user.calendly_follow_up_2_date && user.calendly_follow_up_2_status) {
          const followUpDate = followUpDates.calendlyFollowUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp2.sent++;
            
            // Add to hourly chart data
            const hour = followUpDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].calendlyFollowUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_2_sent',
              activityDate: user.calendly_follow_up_2_date,
              activityTime: user.calendly_follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.unsubscribed++;
          }
        }
        
        // Process replies
        if (user.email_reply_date && user.replied) {
          const replyDate = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (replyDate && isWithinInterval(replyDate, { start: fromDate, end: toDate })) {
            stats.totalReplies++;
            
            // Add to hourly chart data
            const hour = replyDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].repliesReceived++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `reply_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'reply_received',
              activityDate: user.email_reply_date,
              activityTime: user.email_reply_time,
              timestamp: replyDate
            });
          }
        }
        
        // Process calendly clicks
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const clickDate = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalCalendlyClicks++;
            
            // Add to hourly chart data
            const hour = clickDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].calendlyClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_clicked',
              activityDate: user.calendly_click_date,
              activityTime: user.calendly_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process onboarding clicks
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const clickDate = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingClicks++;
            
            // Add to hourly chart data
            const hour = clickDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].onboardingClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_clicked',
              activityDate: user.onboarding_click_date,
              activityTime: user.onboarding_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process completed onboardings
        if (user.onboarding_date && user.onboarding_status === 'completed') {
          const onboardingDate = parseDateTime(user.onboarding_date, null);
          
          if (onboardingDate && isWithinInterval(onboardingDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingsCompleted++;
            
            // For hourly data
            const hour = onboardingDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].onboardingsCompleted++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_complete_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_completed',
              activityDate: user.onboarding_date,
              activityTime: null,
              timestamp: onboardingDate
            });
          }
        }
        
        // Process video calls
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const callDate = parseDateTime(user.video_call_date, null);
          
          if (callDate && isWithinInterval(callDate, { start: fromDate, end: toDate })) {
            stats.totalVideoCallsScheduled++;
            
            // Add to hourly chart data
            const hour = callDate.getHours();
            const hourIndex = chartData.findIndex(data => {
              const dataHour = new Date(data.date).getHours();
              return dataHour === hour;
            });
            
            if (hourIndex !== -1) {
              chartData[hourIndex].videoCallsScheduled++;
            } else {
              // If no hour is specified, add to first hour of the day
              chartData[0].videoCallsScheduled++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `video_call_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'video_call_scheduled',
              activityDate: user.video_call_date,
              activityTime: null,
              timestamp: callDate
            });
          }
        }
        
        // Count unsubscribes
        if (user.unsubscribed && user.unsubscribe_date) {
          const unsubDate = parseDateTime(user.unsubscribe_date, null);
          
          if (unsubDate && isWithinInterval(unsubDate, { start: fromDate, end: toDate })) {
            stats.totalUnsubscribes++;
            
            // Add to recent activity
            recentActivity.push({
              id: `unsubscribe_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'unsubscribed',
              activityDate: user.unsubscribe_date,
              activityTime: null,
              timestamp: unsubDate
            });
          }
        }
      });
      
      // Sort recent activity by timestamp (newest first)
      recentActivity.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp - a.timestamp;
      });
      
      // Calculate rates - use totalEmails for more accurate rates
      const totalSentEmails = stats.totalDelivered + stats.totalBounced;
      stats.replyRate = totalSentEmails > 0 ? (stats.totalReplies / totalSentEmails) * 100 : 0;
      stats.bounceRate = totalSentEmails > 0 ? (stats.totalBounced / totalSentEmails) * 100 : 0;
      stats.calendlyClickRate = totalSentEmails > 0 ? (stats.totalCalendlyClicks / totalSentEmails) * 100 : 0;
      stats.onboardingClickRate = totalSentEmails > 0 ? (stats.totalOnboardingClicks / totalSentEmails) * 100 : 0;
      
      // Return the hourly data
      return res.json({
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd")
        },
        stats,
        chartData,
        recentActivity: recentActivity.slice(0, 20),
        status: "success"
      });
    } else {
      // Generate daily intervals for chart data
      const chartInterval = eachDayOfInterval({ start: fromDate, end: toDate });
      
      // Initialize daily chart data
      const chartData = chartInterval.map(day => {
        return {
          date: format(day, "yyyy-MM-dd"),
          emailsSent: 0,
          emailsDelivered: 0,
          emailsBounced: 0,
          repliesReceived: 0,
          calendlyClicks: 0,
          onboardingClicks: 0,
          videoCallsScheduled: 0,
          onboardingsCompleted: 0,
          // Add follow-up tracking
          followUp1Sent: 0,
          followUp2Sent: 0,
          followUp3Sent: 0,
          onboardingFollowUp1Sent: 0,
          onboardingFollowUp2Sent: 0,
          calendlyFollowUp1Sent: 0,
          calendlyFollowUp2Sent: 0
        };
      });
      
      // Process each user's data
      users.forEach(user => {
        // Store dates for later comparison
        const followUpDates = {
          followUp1: parseDateTime(user.follow_up_1_date, user.follow_up_1_time),
          followUp2: parseDateTime(user.follow_up_2_date, user.follow_up_2_time),
          followUp3: parseDateTime(user.follow_up_3_date, user.follow_up_3_time),
          onboardingFollowUp1: parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time),
          onboardingFollowUp2: parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time),
          calendlyFollowUp1: parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time),
          calendlyFollowUp2: parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time)
        };
        
        const replyDate = user.replied ? parseDateTime(user.email_reply_date, user.email_reply_time) : null;
        const onboardingClickDate = user.onboarding_link_clicked ? parseDateTime(user.onboarding_click_date, user.onboarding_click_time) : null;
        const calendlyClickDate = user.calendly_link_clicked ? parseDateTime(user.calendly_click_date, user.calendly_click_time) : null;
        const unsubscribeDate = user.unsubscribed ? parseDateTime(user.unsubscribe_date, null) : null;
        
        // Process email sent (both scheduled + sent)
        if (user.first_email_date && (user.first_email_status === 'sent' || user.first_email_status === 'scheduled')) {
          const emailDate = parseDateTime(user.first_email_date, user.first_email_time);
          
          if (emailDate && isWithinInterval(emailDate, { start: fromDate, end: toDate })) {
            stats.totalEmails++;
            
            // Count as delivered only if status is 'sent' and not bounced
            if (user.first_email_status === 'sent') {
              if (user.is_bounced) {
                stats.totalBounced++;
              } else {
                stats.totalDelivered++;
              }
            }
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(emailDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].emailsSent++;
              if (user.first_email_status === 'sent') {
                if (user.is_bounced) {
                  chartData[dayIndex].emailsBounced++;
                } else {
                  chartData[dayIndex].emailsDelivered++;
                }
              }
            }
            
            // Add to recent activity
            recentActivity.push({
              id: user.id,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: user.is_bounced ? 'email_bounced' : 'email_sent',
              activityDate: user.first_email_date,
              activityTime: user.first_email_time,
              timestamp: emailDate
            });
          }
        }
        
        // Process follow-up emails
        
        // Follow-up 1
        if (user.follow_up_1_date && user.follow_up_1_status) {
          const followUpDate = followUpDates.followUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].followUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_1_sent',
              activityDate: user.follow_up_1_date,
              activityTime: user.follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp1.unsubscribed++;
          }
        }
        
        // Follow-up 2
        if (user.follow_up_2_date && user.follow_up_2_status) {
          const followUpDate = followUpDates.followUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].followUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_2_sent',
              activityDate: user.follow_up_2_date,
              activityTime: user.follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp2.unsubscribed++;
          }
        }
        
        // Follow-up 3
        if (user.follow_up_3_date && user.follow_up_3_status) {
          const followUpDate = followUpDates.followUp3;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp3.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].followUp3Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `follow_up_3_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_3_sent',
              activityDate: user.follow_up_3_date,
              activityTime: user.follow_up_3_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.followUp3.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.followUp3.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.followUp3.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.followUp3.unsubscribed++;
          }
        }
        
        // Onboarding Follow-up 1
        if (user.onboarding_follow_up_1_date && user.onboarding_follow_up_1_status) {
          const followUpDate = followUpDates.onboardingFollowUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].onboardingFollowUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_1_sent',
              activityDate: user.onboarding_follow_up_1_date,
              activityTime: user.onboarding_follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp1.unsubscribed++;
          }
        }
        
        // Onboarding Follow-up 2
        if (user.onboarding_follow_up_2_date && user.onboarding_follow_up_2_status) {
          const followUpDate = followUpDates.onboardingFollowUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].onboardingFollowUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_2_sent',
              activityDate: user.onboarding_follow_up_2_date,
              activityTime: user.onboarding_follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.onboardingFollowUp2.unsubscribed++;
          }
        }
        
        // Calendly Follow-up 1
        if (user.calendly_follow_up_1_date && user.calendly_follow_up_1_status) {
          const followUpDate = followUpDates.calendlyFollowUp1;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].calendlyFollowUp1Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_1_sent',
              activityDate: user.calendly_follow_up_1_date,
              activityTime: user.calendly_follow_up_1_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp1.unsubscribed++;
          }
        }
        
        // Calendly Follow-up 2
        if (user.calendly_follow_up_2_date && user.calendly_follow_up_2_status) {
          const followUpDate = followUpDates.calendlyFollowUp2;
          
          if (followUpDate && isWithinInterval(followUpDate, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUpDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].calendlyFollowUp2Sent++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_2_sent',
              activityDate: user.calendly_follow_up_2_date,
              activityTime: user.calendly_follow_up_2_time,
              timestamp: followUpDate
            });
          }
          
          // Check if actions happened after this follow-up
          if (replyDate && isAfter(replyDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.replied++;
          }
          
          if (onboardingClickDate && isAfter(onboardingClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.onboardingClicked++;
          }
          
          if (calendlyClickDate && isAfter(calendlyClickDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.calendlyClicked++;
          }
          
          if (unsubscribeDate && isAfter(unsubscribeDate, followUpDate)) {
            stats.totalFollowUps.calendlyFollowUp2.unsubscribed++;
          }
        }
        
        // Process replies
        if (user.email_reply_date && user.replied) {
          const replyDate = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (replyDate && isWithinInterval(replyDate, { start: fromDate, end: toDate })) {
            stats.totalReplies++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(replyDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].repliesReceived++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `reply_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'reply_received',
              activityDate: user.email_reply_date,
              activityTime: user.email_reply_time,
              timestamp: replyDate
            });
          }
        }
        
        // Process calendly clicks
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const clickDate = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalCalendlyClicks++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(clickDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].calendlyClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `calendly_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_clicked',
              activityDate: user.calendly_click_date,
              activityTime: user.calendly_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process onboarding clicks
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const clickDate = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (clickDate && isWithinInterval(clickDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingClicks++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(clickDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].onboardingClicks++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_clicked',
              activityDate: user.onboarding_click_date,
              activityTime: user.onboarding_click_time,
              timestamp: clickDate
            });
          }
        }
        
        // Process completed onboardings
        if (user.onboarding_date && user.onboarding_status === 'completed') {
          const onboardingDate = parseDateTime(user.onboarding_date, null);
          
          if (onboardingDate && isWithinInterval(onboardingDate, { start: fromDate, end: toDate })) {
            stats.totalOnboardingsCompleted++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(onboardingDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].onboardingsCompleted++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `onboarding_complete_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_completed',
              activityDate: user.onboarding_date,
              activityTime: null,
              timestamp: onboardingDate
            });
          }
        }
        
        // Process video calls
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const callDate = parseDateTime(user.video_call_date, null);
          
          if (callDate && isWithinInterval(callDate, { start: fromDate, end: toDate })) {
            stats.totalVideoCallsScheduled++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(callDate, 'yyyy-MM-dd');
            
            // Find the matching day in chartData
            const dayIndex = chartData.findIndex(day => day.date === formattedDate);
            
            if (dayIndex !== -1) {
              chartData[dayIndex].videoCallsScheduled++;
            }
            
            // Add to recent activity
            recentActivity.push({
              id: `video_call_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'video_call_scheduled',
              activityDate: user.video_call_date,
              activityTime: null,
              timestamp: callDate
            });
          }
        }
        
        // Count unsubscribes
        if (user.unsubscribed && user.unsubscribe_date) {
          const unsubDate = parseDateTime(user.unsubscribe_date, null);
          
          if (unsubDate && isWithinInterval(unsubDate, { start: fromDate, end: toDate })) {
            stats.totalUnsubscribes++;
            
            // Add to recent activity
            recentActivity.push({
              id: `unsubscribe_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'unsubscribed',
              activityDate: user.unsubscribe_date,
              activityTime: null,
              timestamp: unsubDate
            });
          }
        }
      });
      
      // Sort recent activity by timestamp (newest first)
      recentActivity.sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp - a.timestamp;
      });
      
      // Calculate rates - use totalSentEmails for more accurate rates
      const totalSentEmails = stats.totalDelivered + stats.totalBounced;
      stats.replyRate = totalSentEmails > 0 ? (stats.totalReplies / totalSentEmails) * 100 : 0;
      stats.bounceRate = totalSentEmails > 0 ? (stats.totalBounced / totalSentEmails) * 100 : 0;
      stats.calendlyClickRate = totalSentEmails > 0 ? (stats.totalCalendlyClicks / totalSentEmails) * 100 : 0;
      stats.onboardingClickRate = totalSentEmails > 0 ? (stats.totalOnboardingClicks / totalSentEmails) * 100 : 0;
      
      // Return the daily data
      return res.json({
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd")
        },
        stats,
        chartData,
        recentActivity: recentActivity.slice(0, 20),
        status: "success"
      });
    }
    
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ 
      error: "Failed to fetch dashboard stats",
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/dashboard/pocs
 * Get list of POCs for filter dropdown
 */
router.get("/pocs", async (req, res) => {
  try {
    const results = await db("stir_outreach_dashboard")
      .distinct("poc")
      .whereNotNull("poc")
      .orderBy("poc");
    
    const pocs = results.map(item => item.poc);
    res.json(pocs);
  } catch (error) {
    console.error("Error fetching POCs:", error);
    res.status(500).json({ error: "Failed to fetch POCs" });
  }
});

/**
 * GET /api/dashboard
 * Main dashboard endpoint for backwards compatibility
 */
router.get("/", async (req, res) => {
  try {
    // Redirect to the stats endpoint
    const {
      timeRange = "last7days",
      dateFrom,
      dateTo,
      poc = "all",
    } = req.query;

    let redirectUrl = `/api/dashboard/stats?timeRange=${timeRange}&poc=${poc}`;
    
    if (timeRange === "custom" && dateFrom && dateTo) {
      redirectUrl += `&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    }
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error processing dashboard request:", error);
    res.status(500).json({ error: "Failed to process dashboard request" });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent activity for the dashboard
 */
/**
 * GET /api/dashboard/recent-activity
 * Get recent activity for the dashboard
 */
/**
 * GET /api/dashboard/recent-activity
 * Get recent activity for the dashboard
 */
router.get("/recent-activity", async (req, res) => {
  try {
    console.log("Fetching recent activity...");
    
    // Get all users data - freshly fetched each time the route is hit
    const users = await db("stir_outreach_dashboard");
    
    console.log(`Found ${users.length} users in the database`);
    
    // If no users found, return empty array
    if (users.length === 0) {
      return res.json({
        activities: [],
        status: "success"
      });
    }
    
    // Collect all activities
    let allActivities = [];
    let dateDebug = new Set(); // For debugging date ranges
    
    // Helper function to parse dates consistently and more robustly
    const parseDateTime = (dateStr, timeStr) => {
      if (!dateStr) return null;
      
      try {
        // Handle different date formats
        let date;
        
        // Try ISO format first (YYYY-MM-DD)
        if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Create a consistent date-time string
          const dateTimeStr = `${dateStr}T${timeStr || '00:00:00'}`;
          date = new Date(dateTimeStr);
        } 
        // Try other formats
        else {
          date = new Date(dateStr);
        }
        
        // Validate the date
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date: ${dateStr} ${timeStr}`);
          return null;
        }
        
        // Log date range for debugging
        dateDebug.add(date.toISOString().split('T')[0]);
        
        return date;
      } catch (err) {
        console.warn(`Error parsing date: ${dateStr} ${timeStr}`, err);
        return null;
      }
    };
    
    users.forEach(user => {
      try {
        // Add email sent activity or bounced email
        if (user.first_email_date && user.first_email_status === 'sent') {
          const timestamp = parseDateTime(user.first_email_date, user.first_email_time);
          
          if (timestamp) {
            allActivities.push({
              id: `email_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: user.is_bounced ? 'email_bounced' : 'email_sent',
              activityDate: user.first_email_date,
              activityTime: user.first_email_time,
              dateString: `${user.first_email_date} ${user.first_email_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add follow-up 1 activity
        if (user.follow_up_1_date && user.follow_up_1_status) {
          const timestamp = parseDateTime(user.follow_up_1_date, user.follow_up_1_time);
          
          if (timestamp) {
            allActivities.push({
              id: `follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_1_sent',
              activityDate: user.follow_up_1_date,
              activityTime: user.follow_up_1_time,
              dateString: `${user.follow_up_1_date} ${user.follow_up_1_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add follow-up 2 activity
        if (user.follow_up_2_date && user.follow_up_2_status) {
          const timestamp = parseDateTime(user.follow_up_2_date, user.follow_up_2_time);
          
          if (timestamp) {
            allActivities.push({
              id: `follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_2_sent',
              activityDate: user.follow_up_2_date,
              activityTime: user.follow_up_2_time,
              dateString: `${user.follow_up_2_date} ${user.follow_up_2_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add follow-up 3 activity
        if (user.follow_up_3_date && user.follow_up_3_status) {
          const timestamp = parseDateTime(user.follow_up_3_date, user.follow_up_3_time);
          
          if (timestamp) {
            allActivities.push({
              id: `follow_up_3_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'follow_up_3_sent',
              activityDate: user.follow_up_3_date,
              activityTime: user.follow_up_3_time,
              dateString: `${user.follow_up_3_date} ${user.follow_up_3_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add onboarding follow-up 1 activity
        if (user.onboarding_follow_up_1_date && user.onboarding_follow_up_1_status) {
          const timestamp = parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time);
          
          if (timestamp) {
            allActivities.push({
              id: `onboarding_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_1_sent',
              activityDate: user.onboarding_follow_up_1_date,
              activityTime: user.onboarding_follow_up_1_time,
              dateString: `${user.onboarding_follow_up_1_date} ${user.onboarding_follow_up_1_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add onboarding follow-up 2 activity
        if (user.onboarding_follow_up_2_date && user.onboarding_follow_up_2_status) {
          const timestamp = parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time);
          
          if (timestamp) {
            allActivities.push({
              id: `onboarding_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_follow_up_2_sent',
              activityDate: user.onboarding_follow_up_2_date,
              activityTime: user.onboarding_follow_up_2_time,
              dateString: `${user.onboarding_follow_up_2_date} ${user.onboarding_follow_up_2_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add calendly follow-up 1 activity
        if (user.calendly_follow_up_1_date && user.calendly_follow_up_1_status) {
          const timestamp = parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time);
          
          if (timestamp) {
            allActivities.push({
              id: `calendly_follow_up_1_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_1_sent',
              activityDate: user.calendly_follow_up_1_date,
              activityTime: user.calendly_follow_up_1_time,
              dateString: `${user.calendly_follow_up_1_date} ${user.calendly_follow_up_1_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add calendly follow-up 2 activity
        if (user.calendly_follow_up_2_date && user.calendly_follow_up_2_status) {
          const timestamp = parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time);
          
          if (timestamp) {
            allActivities.push({
              id: `calendly_follow_up_2_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_follow_up_2_sent',
              activityDate: user.calendly_follow_up_2_date,
              activityTime: user.calendly_follow_up_2_time,
              dateString: `${user.calendly_follow_up_2_date} ${user.calendly_follow_up_2_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add reply received activity
        if (user.email_reply_date && user.replied) {
          const timestamp = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (timestamp) {
            allActivities.push({
              id: `reply_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'reply_received',
              activityDate: user.email_reply_date,
              activityTime: user.email_reply_time,
              dateString: `${user.email_reply_date} ${user.email_reply_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add calendly click activity
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const timestamp = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (timestamp) {
            allActivities.push({
              id: `calendly_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'calendly_clicked',
              activityDate: user.calendly_click_date,
              activityTime: user.calendly_click_time,
              dateString: `${user.calendly_click_date} ${user.calendly_click_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add onboarding click activity
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const timestamp = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (timestamp) {
            allActivities.push({
              id: `onboarding_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_clicked',
              activityDate: user.onboarding_click_date,
              activityTime: user.onboarding_click_time,
              dateString: `${user.onboarding_click_date} ${user.onboarding_click_time || '00:00:00'}`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add onboarding completion activity
        if (user.onboarding_date && user.onboarding_status === 'completed') {
          const timestamp = parseDateTime(user.onboarding_date, null);
          
          if (timestamp) {
            allActivities.push({
              id: `onboarding_complete_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'onboarding_completed',
              activityDate: user.onboarding_date,
              activityTime: null,
              dateString: `${user.onboarding_date} 00:00:00`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add video call scheduled activity
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const timestamp = parseDateTime(user.video_call_date, null);
          
          if (timestamp) {
            allActivities.push({
              id: `video_call_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'video_call_scheduled',
              activityDate: user.video_call_date,
              activityTime: null,
              dateString: `${user.video_call_date} 00:00:00`,
              timestamp: timestamp.getTime()
            });
          }
        }
        
        // Add unsubscribe activity
        if (user.unsubscribed && user.unsubscribe_date) {
          const timestamp = parseDateTime(user.unsubscribe_date, null);
          
          if (timestamp) {
            allActivities.push({
              id: `unsubscribe_${user.id}`,
              userId: user.user_id,
              username: user.username || 'Unknown',
              name: user.name || user.username || 'Unknown',
              email: user.business_email || 'No email',
              poc: user.poc || 'Unknown POC',
              activityType: 'unsubscribed',
              activityDate: user.unsubscribe_date,
              activityTime: null,
              dateString: `${user.unsubscribe_date} 00:00:00`,
              timestamp: timestamp.getTime()
            });
          }
        }
      } catch (err) {
        console.warn(`Error processing user ${user.id}:`, err);
        // Continue with the next user
      }
    });
    

    
    // Log the earliest and latest timestamps before sorting
    if (allActivities.length > 0) {
      const timestamps = allActivities.map(a => a.timestamp);
      const minTimestamp = new Date(Math.min(...timestamps));
      const maxTimestamp = new Date(Math.max(...timestamps));
      console.log(`Timestamp range: ${minTimestamp.toISOString()} to ${maxTimestamp.toISOString()}`);
    }
    
    // Sort by timestamp (most recent first)
    allActivities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get the most recent activities (limit to 100 to avoid too much data)
    const recentActivities = allActivities.slice(0, 250);
    
    // Log the earliest and latest activities after sorting
    if (recentActivities.length > 0) {
      const firstActivity = recentActivities[0];
      const lastActivity = recentActivities[recentActivities.length - 1];
      console.log(`First activity: ${firstActivity.activityDate} (${firstActivity.activityType})`);
      console.log(`Last activity: ${lastActivity.activityDate} (${lastActivity.activityType})`);
    }
    
    // Return the results
    res.json({
      activities: recentActivities,
      total: allActivities.length,
      status: "success"
    });
    
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ 
      error: "Failed to fetch recent activity",
      details: error.message
    });
  }
});
export default router;