import generateNewSnippet from './generateNewSnippet.js'
import fs from 'fs';

// Function to randomly select one option from spintax


// Function to generate email body
function generateEmailBody(recipient) {
    const template = `Hi @${recipient.username}, I'm Yug Dave

${recipient.r1snippet}

We're building something exciting at Stir—an invite-only marketplace to connect influencers like you with indie filmmakers and major studios, offering early access to upcoming releases.

What makes us unique? Vetted clients. Built-in AI. Fast payments. A flat 10% take rate.

I'd love to hear your thoughts and see if this is something you'd like to explore!

No pressure—feel free to reply to this email or set up a quick call here: createstir.com/calendly. Or if you're ready to dive in, you can also onboard here: createstir.com/onboard.

Best,
Yug Dave
VP of Stellar Beginnings!

PS: @spaceofcenema and @filmtvrate others have recently got their exclusive access to Stir!`;

    return template;
}

async function processData() {
    try {
        // Read the input JSON file
        const rawData = fs.readFileSync('output.json');
        const data = JSON.parse(rawData);

        // Process each user
        const processedData = await Promise.all(data.map(async (user) => {
            // Extract required fields
            const username = user.username;
            const biography = user.biography;
            const captions = [
                user.caption1,
                user.caption2,
                user.caption3,
                user.caption4,
                user.caption5
            ].filter(caption => caption); // Remove any undefined/null values

            // Generate R1 snippets
            const r1snippet = await generateNewSnippet(
                username,
                captions,
                biography
            );

            // Create email body
            const emailBody = generateEmailBody({
                username,
                r1snippet
            });

            // Return structured data
            return {
                username,
                r1snippet,
                emailBody
            };
        }));

        // Write to new JSON file
        fs.writeFileSync('newPrompt.json', JSON.stringify(processedData, null, 2));
        console.log('Successfully generated newPrompt.json');

    } catch (error) {
        console.error('Error processing data:', error);
    }
}

processData();