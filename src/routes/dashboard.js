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
  isAfter,
  isValid,
  isBefore,
  compareDesc,
  parseISO,
  isSameDay,
  parse,
} from "date-fns";

const router = express.Router();  



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
    
    // Helper function to check if a follow-up was sent
    const isFollowUpSent = (status) => {
      if (!status) return false;
      const statusLower = status.toLowerCase();
      return statusLower === 'sent' || statusLower === 'true' || statusLower === 'scheduled';
    };
    
    // Helper function to determine which email prompted an action
    const determineSourceEmail = (actionDate, emailDates) => {
      if (!actionDate) return null;
      
      // Create array of valid email dates with their types
      const validEmails = Object.entries(emailDates)
        .filter(([_, date]) => date !== null && isValid(date) && isBefore(date, actionDate))
        .sort((a, b) => compareDesc(a[1], b[1])); // Sort by most recent first
      
      // Return the most recent email before the action
      return validEmails.length > 0 ? validEmails[0][0] : null;
    };
    
    // Initialize statistics
    const stats = {
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
      }
    };
    
    // Initialize recent activity array
    const recentActivity = [];
    
    // Track each follow-up sent for debugging
    const followUpSentCounts = {
      followUp1: 0,
      followUp2: 0,
      followUp3: 0,
      onboardingFollowUp1: 0,
      onboardingFollowUp2: 0,
      calendlyFollowUp1: 0,
      calendlyFollowUp2: 0
    };
    
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
        // Parse all the dates
        const firstEmailDate = parseDateTime(user.first_email_date, user.first_email_time);
        const followUp1Date = parseDateTime(user.follow_up_1_date, user.follow_up_1_time);
        const followUp2Date = parseDateTime(user.follow_up_2_date, user.follow_up_2_time);
        const followUp3Date = parseDateTime(user.follow_up_3_date, user.follow_up_3_time);
        const onboardingFollowUp1Date = parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time);
        const onboardingFollowUp2Date = parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time);
        const calendlyFollowUp1Date = parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time);
        const calendlyFollowUp2Date = parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time);
        
        // Store dates for all email events
        const followUpDates = {
          firstEmail: firstEmailDate,
          followUp1: followUp1Date,
          followUp2: followUp2Date,
          followUp3: followUp3Date,
          onboardingFollowUp1: onboardingFollowUp1Date,
          onboardingFollowUp2: onboardingFollowUp2Date,
          calendlyFollowUp1: calendlyFollowUp1Date,
          calendlyFollowUp2: calendlyFollowUp2Date
        };
        
        const replyDate = user.replied ? parseDateTime(user.email_reply_date, user.email_reply_time) : null;
        const onboardingClickDate = user.onboarding_link_clicked ? parseDateTime(user.onboarding_click_date, user.onboarding_click_time) : null;
        const calendlyClickDate = user.calendly_link_clicked ? parseDateTime(user.calendly_click_date, user.calendly_click_time) : null;
        const unsubscribeDate = user.unsubscribed ? parseDateTime(user.unsubscribe_date, null) : null;
        
        // Process email sent (both scheduled + sent)
        if (firstEmailDate && (user.first_email_status === 'sent' || user.first_email_status === 'scheduled')) {
          if (isWithinInterval(firstEmailDate, { start: fromDate, end: toDate })) {
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
            const hour = firstEmailDate.getHours();
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
              timestamp: firstEmailDate
            });
          }
        }
        
        // Process regular follow-ups
        // Follow-up 1
        if (followUp1Date && isFollowUpSent(user.follow_up_1_status)) {
          followUpSentCounts.followUp1++;
          
          if (isWithinInterval(followUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp1.sent++;
            
            // Add to hourly chart data
            const hour = followUp1Date.getHours();
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
              timestamp: followUp1Date
            });
          }
        }
        
        // Follow-up 2
        if (followUp2Date && isFollowUpSent(user.follow_up_2_status)) {
          followUpSentCounts.followUp2++;
          
          if (isWithinInterval(followUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp2.sent++;
            
            // Add to hourly chart data
            const hour = followUp2Date.getHours();
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
              timestamp: followUp2Date
            });
          }
        }
        
        // Follow-up 3
        if (followUp3Date && isFollowUpSent(user.follow_up_3_status)) {
          followUpSentCounts.followUp3++;
          
          if (isWithinInterval(followUp3Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp3.sent++;
            
            // Add to hourly chart data
            const hour = followUp3Date.getHours();
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
              timestamp: followUp3Date
            });
          }
        }
        
        // Onboarding Follow-up 1
        if (onboardingFollowUp1Date && isFollowUpSent(user.onboarding_follow_up_1_status)) {
          followUpSentCounts.onboardingFollowUp1++;
          
          if (isWithinInterval(onboardingFollowUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp1.sent++;
            
            // Add to hourly chart data
            const hour = onboardingFollowUp1Date.getHours();
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
              timestamp: onboardingFollowUp1Date
            });
          }
        }
        
        // Onboarding Follow-up 2
        if (onboardingFollowUp2Date && isFollowUpSent(user.onboarding_follow_up_2_status)) {
          followUpSentCounts.onboardingFollowUp2++;
          
          if (isWithinInterval(onboardingFollowUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp2.sent++;
            
            // Add to hourly chart data
            const hour = onboardingFollowUp2Date.getHours();
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
              timestamp: onboardingFollowUp2Date
            });
          }
        }
        
        // Calendly Follow-up 1
        if (calendlyFollowUp1Date && isFollowUpSent(user.calendly_follow_up_1_status)) {
          followUpSentCounts.calendlyFollowUp1++;
          
          if (isWithinInterval(calendlyFollowUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp1.sent++;
            
            // Add to hourly chart data
            const hour = calendlyFollowUp1Date.getHours();
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
              timestamp: calendlyFollowUp1Date
            });
          }
        }
        
        // Calendly Follow-up 2
        if (calendlyFollowUp2Date && isFollowUpSent(user.calendly_follow_up_2_status)) {
          followUpSentCounts.calendlyFollowUp2++;
          
          if (isWithinInterval(calendlyFollowUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp2.sent++;
            
            // Add to hourly chart data
            const hour = calendlyFollowUp2Date.getHours();
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
              timestamp: calendlyFollowUp2Date
            });
          }
        }
        
        // Process replies and determine which email prompted the reply
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
          
          // Determine which email prompted the reply
          const sourceEmail = determineSourceEmail(replyDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.replied++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.replied++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.replied++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.replied++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.replied++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.replied++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.replied++;
            }
          }
        }
        
        // Process calendly clicks
        if (calendlyClickDate && isWithinInterval(calendlyClickDate, { start: fromDate, end: toDate })) {
          stats.totalCalendlyClicks++;
          
          // Add to hourly chart data
          const hour = calendlyClickDate.getHours();
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
            timestamp: calendlyClickDate
          });
          
          // Determine which email prompted the click
          const sourceEmail = determineSourceEmail(calendlyClickDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.calendlyClicked++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.calendlyClicked++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.calendlyClicked++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.calendlyClicked++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.calendlyClicked++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.calendlyClicked++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.calendlyClicked++;
            }
          }
        }
        
        // Process onboarding clicks
        if (onboardingClickDate && isWithinInterval(onboardingClickDate, { start: fromDate, end: toDate })) {
          stats.totalOnboardingClicks++;
          
          // Add to hourly chart data
          const hour = onboardingClickDate.getHours();
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
            timestamp: onboardingClickDate
          });
          
          // Determine which email prompted the click
          const sourceEmail = determineSourceEmail(onboardingClickDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.onboardingClicked++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.onboardingClicked++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.onboardingClicked++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.onboardingClicked++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.onboardingClicked++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.onboardingClicked++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.onboardingClicked++;
            }
          }
        }
        
        // Process unsubscribes and determine which email prompted the unsubscribe
        if (unsubscribeDate && isWithinInterval(unsubscribeDate, { start: fromDate, end: toDate })) {
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
            timestamp: unsubscribeDate
          });
          
          // Determine which email prompted the unsubscribe
          const sourceEmail = determineSourceEmail(unsubscribeDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.unsubscribed++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.unsubscribed++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.unsubscribed++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.unsubscribed++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.unsubscribed++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.unsubscribed++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.unsubscribed++;
            }
          }
        }
        
        // Process completed onboardings - just check the status
        if (user.onboarding_status === 'completed') {
          stats.totalOnboardingsCompleted++;
          
          // Calculate the day index to add this to chart data
          const currentDate = firstEmailDate || new Date(); // Use first email date or current date as fallback
          const hour = currentDate.getHours();
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
            activityDate: null,
            activityTime: null,
            timestamp: new Date()
          });
        }
        
        // Process video calls - just check if status is 'scheduled'
        if (user.video_call_status === 'scheduled') {
          stats.totalVideoCallsScheduled++;
          
          // Calculate the day index to add this to chart data
          const currentDate = firstEmailDate || new Date(); // Use first email date or current date as fallback
          const hour = currentDate.getHours();
          const hourIndex = chartData.findIndex(data => {
            const dataHour = new Date(data.date).getHours();
            return dataHour === hour;
          });
          
          if (hourIndex !== -1) {
            chartData[hourIndex].videoCallsScheduled++;
          }
          
          // Add to recent activity
          recentActivity.push({
            id: `video_call_${user.id}`,
            userId: user.user_id,
            username: user.username || 'Unknown',
            email: user.business_email || 'No email',
            poc: user.poc || 'Unknown POC',
            activityType: 'video_call_scheduled',
            activityDate: null,
            activityTime: null,
            timestamp: new Date()
          });
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
        followUpSentCounts, // Include for debugging
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
        // Parse all the dates
        const firstEmailDate = parseDateTime(user.first_email_date, user.first_email_time);
        const followUp1Date = parseDateTime(user.follow_up_1_date, user.follow_up_1_time);
        const followUp2Date = parseDateTime(user.follow_up_2_date, user.follow_up_2_time);
        const followUp3Date = parseDateTime(user.follow_up_3_date, user.follow_up_3_time);
        const onboardingFollowUp1Date = parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time);
        const onboardingFollowUp2Date = parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time);
        const calendlyFollowUp1Date = parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time);
        const calendlyFollowUp2Date = parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time);
        
        // Store dates for all email events
        const followUpDates = {
          firstEmail: firstEmailDate,
          followUp1: followUp1Date,
          followUp2: followUp2Date,
          followUp3: followUp3Date,
          onboardingFollowUp1: onboardingFollowUp1Date,
          onboardingFollowUp2: onboardingFollowUp2Date,
          calendlyFollowUp1: calendlyFollowUp1Date,
          calendlyFollowUp2: calendlyFollowUp2Date
        };
        
        const replyDate = user.replied ? parseDateTime(user.email_reply_date, user.email_reply_time) : null;
        const onboardingClickDate = user.onboarding_link_clicked ? parseDateTime(user.onboarding_click_date, user.onboarding_click_time) : null;
        const calendlyClickDate = user.calendly_link_clicked ? parseDateTime(user.calendly_click_date, user.calendly_click_time) : null;
        const unsubscribeDate = user.unsubscribed ? parseDateTime(user.unsubscribe_date, null) : null;
        
        // Process email sent (both scheduled + sent)
        if (firstEmailDate && (user.first_email_status === 'sent' || user.first_email_status === 'scheduled')) {
          if (isWithinInterval(firstEmailDate, { start: fromDate, end: toDate })) {
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
            const formattedDate = format(firstEmailDate, 'yyyy-MM-dd');
            
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
              timestamp: firstEmailDate
            });
          }
        }
        
        // Process regular follow-ups
        // Follow-up 1
        if (followUp1Date && isFollowUpSent(user.follow_up_1_status)) {
          followUpSentCounts.followUp1++;
          
          if (isWithinInterval(followUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUp1Date, 'yyyy-MM-dd');
            
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
              timestamp: followUp1Date
            });
          }
        }
        
        // Follow-up 2
        if (followUp2Date && isFollowUpSent(user.follow_up_2_status)) {
          followUpSentCounts.followUp2++;
          
          if (isWithinInterval(followUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUp2Date, 'yyyy-MM-dd');
            
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
              timestamp: followUp2Date
            });
          }
        }
        
        // Follow-up 3
        if (followUp3Date && isFollowUpSent(user.follow_up_3_status)) {
          followUpSentCounts.followUp3++;
          
          if (isWithinInterval(followUp3Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.followUp3.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(followUp3Date, 'yyyy-MM-dd');
            
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
              timestamp: followUp3Date
            });
          }
        }
        
        // Onboarding Follow-up 1
        if (onboardingFollowUp1Date && isFollowUpSent(user.onboarding_follow_up_1_status)) {
          followUpSentCounts.onboardingFollowUp1++;
          
          if (isWithinInterval(onboardingFollowUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(onboardingFollowUp1Date, 'yyyy-MM-dd');
            
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
              timestamp: onboardingFollowUp1Date
            });
          }
        }
        
        // Onboarding Follow-up 2
        if (onboardingFollowUp2Date && isFollowUpSent(user.onboarding_follow_up_2_status)) {
          followUpSentCounts.onboardingFollowUp2++;
          
          if (isWithinInterval(onboardingFollowUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.onboardingFollowUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(onboardingFollowUp2Date, 'yyyy-MM-dd');
            
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
              timestamp: onboardingFollowUp2Date
            });
          }
        }
        
        // Calendly Follow-up 1
        if (calendlyFollowUp1Date && isFollowUpSent(user.calendly_follow_up_1_status)) {
          followUpSentCounts.calendlyFollowUp1++;
          
          if (isWithinInterval(calendlyFollowUp1Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp1.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(calendlyFollowUp1Date, 'yyyy-MM-dd');
            
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
              timestamp: calendlyFollowUp1Date
            });
          }
        }
        
        // Calendly Follow-up 2
        if (calendlyFollowUp2Date && isFollowUpSent(user.calendly_follow_up_2_status)) {
          followUpSentCounts.calendlyFollowUp2++;
          
          if (isWithinInterval(calendlyFollowUp2Date, { start: fromDate, end: toDate })) {
            stats.totalFollowUps.calendlyFollowUp2.sent++;
            
            // Format the date to yyyy-MM-dd for comparison
            const formattedDate = format(calendlyFollowUp2Date, 'yyyy-MM-dd');
            
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
              timestamp: calendlyFollowUp2Date
            });
          }
        }
        
        // Process replies and determine which email prompted the reply
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
          
          // Determine which email prompted the reply
          const sourceEmail = determineSourceEmail(replyDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.replied++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.replied++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.replied++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.replied++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.replied++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.replied++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.replied++;
            }
          }
        }
        
        // Process calendly clicks
        if (calendlyClickDate && isWithinInterval(calendlyClickDate, { start: fromDate, end: toDate })) {
          stats.totalCalendlyClicks++;
          
          // Format the date to yyyy-MM-dd for comparison
          const formattedDate = format(calendlyClickDate, 'yyyy-MM-dd');
          
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
            timestamp: calendlyClickDate
          });
          
          // Determine which email prompted the click
          const sourceEmail = determineSourceEmail(calendlyClickDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.calendlyClicked++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.calendlyClicked++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.calendlyClicked++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.calendlyClicked++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.calendlyClicked++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.calendlyClicked++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.calendlyClicked++;
            }
          }
        }
        
        // Process onboarding clicks
        if (onboardingClickDate && isWithinInterval(onboardingClickDate, { start: fromDate, end: toDate })) {
          stats.totalOnboardingClicks++;
          
          // Format the date to yyyy-MM-dd for comparison
          const formattedDate = format(onboardingClickDate, 'yyyy-MM-dd');
          
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
            timestamp: onboardingClickDate
          });
          
          // Determine which email prompted the click
          const sourceEmail = determineSourceEmail(onboardingClickDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.onboardingClicked++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.onboardingClicked++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.onboardingClicked++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.onboardingClicked++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.onboardingClicked++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.onboardingClicked++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.onboardingClicked++;
            }
          }
        }
        
        // Process unsubscribes and determine which email prompted the unsubscribe
        if (unsubscribeDate && isWithinInterval(unsubscribeDate, { start: fromDate, end: toDate })) {
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
            timestamp: unsubscribeDate
          });
          
          // Determine which email prompted the unsubscribe
          const sourceEmail = determineSourceEmail(unsubscribeDate, followUpDates);
          if (sourceEmail) {
            // Increment the appropriate counter
            if (sourceEmail === 'followUp1') {
              stats.totalFollowUps.followUp1.unsubscribed++;
            } else if (sourceEmail === 'followUp2') {
              stats.totalFollowUps.followUp2.unsubscribed++;
            } else if (sourceEmail === 'followUp3') {
              stats.totalFollowUps.followUp3.unsubscribed++;
            } else if (sourceEmail === 'onboardingFollowUp1') {
              stats.totalFollowUps.onboardingFollowUp1.unsubscribed++;
            } else if (sourceEmail === 'onboardingFollowUp2') {
              stats.totalFollowUps.onboardingFollowUp2.unsubscribed++;
            } else if (sourceEmail === 'calendlyFollowUp1') {
              stats.totalFollowUps.calendlyFollowUp1.unsubscribed++;
            } else if (sourceEmail === 'calendlyFollowUp2') {
              stats.totalFollowUps.calendlyFollowUp2.unsubscribed++;
            }
          }
        }
        
        // Process completed onboardings - just check the status
        if (user.onboarding_status === 'completed') {
          stats.totalOnboardingsCompleted++;
          
          // Calculate the day index to add this to chart data  
          const currentDate = firstEmailDate || new Date(); // Use first email date or current date as fallback
          const formattedDate = format(currentDate, 'yyyy-MM-dd');
          
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
            activityDate: null,
            activityTime: null,
            timestamp: new Date()
          });
        }
        
        // Process video calls - just check if status is 'scheduled'
        if (user.video_call_status === 'scheduled') {
          stats.totalVideoCallsScheduled++;
          
          // Calculate the day index to add this to chart data
          const currentDate = firstEmailDate || new Date(); // Use first email date or current date as fallback
          const formattedDate = format(currentDate, 'yyyy-MM-dd');
          
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
            activityDate: null,
            activityTime: null,
            timestamp: new Date()
          });
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
      
      // Return the daily data
      return res.json({
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd")
        },
        stats,
        chartData,
        recentActivity: recentActivity.slice(0, 20),
        followUpSentCounts, // Include for debugging
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
// Get recent activity for the last 30 days, organized by activity type
router.get("/recent-activity", async (req, res) => {
  try {
    
    // Get all users data - freshly fetched each time the route is hit
    const users = await db("stir_outreach_dashboard");
    
    
    // If no users found, return empty array
    if (users.length === 0) {
      return res.json({
        activities: [],
        activityByType: {},
        status: "success"
      });
    }
    
    // Calculate date for 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Collect all activities
    let allActivities = [];
    let activityByType = {
      email_sent: [],
      email_bounced: [],
      follow_up_1_sent: [],
      follow_up_2_sent: [],
      follow_up_3_sent: [],
      onboarding_follow_up_1_sent: [],
      onboarding_follow_up_2_sent: [],
      calendly_follow_up_1_sent: [],
      calendly_follow_up_2_sent: [],
      reply_received: [],
      calendly_clicked: [],
      onboarding_clicked: [],
      onboarding_completed: [],
      video_call_scheduled: [],
      unsubscribed: []
    };
    
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
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              if (user.is_bounced) {
                activityByType.email_bounced.push(activity);
              } else {
                activityByType.email_sent.push(activity);
              }
            }
          }
        }
        
        // Add follow-up 1 activity
        if (user.follow_up_1_date && user.follow_up_1_status) {
          const timestamp = parseDateTime(user.follow_up_1_date, user.follow_up_1_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.follow_up_1_sent.push(activity);
            }
          }
        }
        
        // Add follow-up 2 activity
        if (user.follow_up_2_date && user.follow_up_2_status) {
          const timestamp = parseDateTime(user.follow_up_2_date, user.follow_up_2_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.follow_up_2_sent.push(activity);
            }
          }
        }
        
        // Add follow-up 3 activity
        if (user.follow_up_3_date && user.follow_up_3_status) {
          const timestamp = parseDateTime(user.follow_up_3_date, user.follow_up_3_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.follow_up_3_sent.push(activity);
            }
          }
        }
        
        // Add onboarding follow-up 1 activity
        if (user.onboarding_follow_up_1_date && user.onboarding_follow_up_1_status) {
          const timestamp = parseDateTime(user.onboarding_follow_up_1_date, user.onboarding_follow_up_1_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.onboarding_follow_up_1_sent.push(activity);
            }
          }
        }
        
        // Add onboarding follow-up 2 activity
        if (user.onboarding_follow_up_2_date && user.onboarding_follow_up_2_status) {
          const timestamp = parseDateTime(user.onboarding_follow_up_2_date, user.onboarding_follow_up_2_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.onboarding_follow_up_2_sent.push(activity);
            }
          }
        }
        
        // Add calendly follow-up 1 activity
        if (user.calendly_follow_up_1_date && user.calendly_follow_up_1_status) {
          const timestamp = parseDateTime(user.calendly_follow_up_1_date, user.calendly_follow_up_1_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.calendly_follow_up_1_sent.push(activity);
            }
          }
        }
        
        // Add calendly follow-up 2 activity
        if (user.calendly_follow_up_2_date && user.calendly_follow_up_2_status) {
          const timestamp = parseDateTime(user.calendly_follow_up_2_date, user.calendly_follow_up_2_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.calendly_follow_up_2_sent.push(activity);
            }
          }
        }
        
        // Add reply received activity
        if (user.email_reply_date && user.replied) {
          const timestamp = parseDateTime(user.email_reply_date, user.email_reply_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.reply_received.push(activity);
            }
          }
        }
        
        // Add calendly click activity
        if (user.calendly_click_date && user.calendly_link_clicked) {
          const timestamp = parseDateTime(user.calendly_click_date, user.calendly_click_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.calendly_clicked.push(activity);
            }
          }
        }
        
        // Add onboarding click activity
        if (user.onboarding_click_date && user.onboarding_link_clicked) {
          const timestamp = parseDateTime(user.onboarding_click_date, user.onboarding_click_time);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.onboarding_clicked.push(activity);
            }
          }
        }
        
        // Add onboarding completion activity
        if (user.onboarding_status === 'completed') {
          const timestamp = parseDateTime(user.onboarding_date, null);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.onboarding_completed.push(activity);
            }
          }
        }
        
        // Add video call scheduled activity
        if (user.video_call_date && user.video_call_status === 'scheduled') {
          const timestamp = parseDateTime(user.video_call_date, null);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.video_call_scheduled.push(activity);
            }
          }
        }
        
        // Add unsubscribe activity
        if (user.unsubscribed && user.unsubscribe_date) {
          const timestamp = parseDateTime(user.unsubscribe_date, null);
          
          if (timestamp) {
            const activity = {
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
            };
            
            allActivities.push(activity);
            
            // Add to appropriate category if in the last 30 days
            if (timestamp >= thirtyDaysAgo) {
              activityByType.unsubscribed.push(activity);
            }
          }
        }
      } catch (err) {
        console.warn(`Error processing user ${user.id}:`, err);
        // Continue with the next user
      }
    });
    
    // Log the date range for debugging
    
    // Sort all activities by timestamp (most recent first)
    allActivities.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get the most recent activities (limit to 250 for overall feed)
    const recentActivities = allActivities;
    
    // Sort each category by timestamp (most recent first)
    Object.keys(activityByType).forEach(key => {
      activityByType[key].sort((a, b) => b.timestamp - a.timestamp);
    });
    
  
    // Return the results
    res.json({
      activities: recentActivities,
      activityByType: activityByType,
      total: allActivities.length,
      last30Days: {
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        totalActivities: Object.values(activityByType).reduce((sum, arr) => sum + arr.length, 0)
      },
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