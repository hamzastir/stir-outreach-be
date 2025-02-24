import dotenv from 'dotenv';
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

async function generateEmailSnippets(username, email, captions, bio) {
    try {
        const prompt1 = `
        Write a personalized email to an influencer, keeping the tone natural and human-like. The email should feel like it was written by a person, not AI. Limit the personalized section to 2-3 lines and keep the rest of the email generic but relevant to the context. The language should be American English.

        Influencer Data:
        - Name: ${username}
        - Email: ${email}
        - Bio: "${bio}"
        - Captions from last 4 posts: "${captions}"

        Keep the response short and engaging. Do not include greetings or signatures.
        `;

        const prompt2 = `
        Generate a professional and formal welcome message for ${username} (${email}). Use their bio: "${bio}" and include a reference to "${captions}". Keep it concise and business-like. Do not include greetings or signatures.
        `;

        const response1 = await openai.chat.completions.create({
            model: "o1-preview",
            messages: [{ role: "user", content: prompt1 }],
        });

        const response2 = await openai.chat.completions.create({
            model: "o1-preview",
            messages: [{ role: "user", content: prompt2 }]
        });

        return {
            snippet1: response1.choices[0]?.message?.content?.trim() || "",
            snippet2: response2.choices[0]?.message?.content?.trim() || "",
        };
    } catch (error) {
        console.error("Error generating email snippets:", error);
        throw error;
    }
}

export default generateEmailSnippets;
