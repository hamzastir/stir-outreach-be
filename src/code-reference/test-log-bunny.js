const PULL_ZONE_ID = '3354347';
const LOGGING_API_KEY = '10732da5-de6d-4847-a173-3be74130e4cb';

async function fetchBunnyCDNLogs() {

    // Construct the URL with today's date
    const url = `https://logging.bunnycdn.com/02-18-25/${PULL_ZONE_ID}.log`;
    
    console.log('Requesting URL:', url); 
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'AccessKey': LOGGING_API_KEY,
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status); // Debug log

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText); // Debug log
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.text();
        
        // Check if we got any data
        if (!data.trim()) {
            console.log('No log data available for this date');
            return [];
        }

        // Parse the log entries
        const logEntries = data.split('\n').filter(line => line.trim() !== '');
        
        // Process each log entry
        const processedLogs = logEntries.map(entry => {
            const [
                cacheStatus,
                statusCode,
                timestamp,
                bytesSent,
                pullZoneId,
                remoteIp,
                refererUrl,
                url,
                edgeLocation,
                userAgent,
                uniqueRequestId,
                countryCode
            ] = entry.split('|');

            return {
                cacheStatus,
                statusCode,
                timestamp: new Date(parseInt(timestamp)),
                bytesSent: parseInt(bytesSent),
                pullZoneId,
                remoteIp,
                refererUrl,
                url,
                edgeLocation,
                userAgent,
                uniqueRequestId,
                countryCode
            };
        });

        return processedLogs;

    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
}

// Example usage:
async function testLoggingAPI() {
    try {
 
        const logs = await fetchBunnyCDNLogs();
        
        if (logs.length === 0) {
            console.log('No logs found for this date');
            return;
        }

        console.log('Total log entries:', logs.length);
        console.log('Sample log entry:', logs[0]);
        
        // You can also analyze the logs
        const cacheHits = logs.filter(log => log.cacheStatus === 'HIT').length;
        const cacheMisses = logs.filter(log => log.cacheStatus === 'MISS').length;
        
        console.log('Cache Hit Ratio:', (cacheHits / logs.length * 100).toFixed(2) + '%');
        console.log('Total Bytes Sent:', logs.reduce((acc, log) => acc + log.bytesSent, 0));
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testLoggingAPI();