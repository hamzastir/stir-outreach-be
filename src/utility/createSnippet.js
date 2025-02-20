import dotenv from 'dotenv';
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

async function generateEmailSnippets(username, email, captions, bio) {
    try {
        const prompt1 = `Generate a friendly and informal welcome message for ${username} (${email}). Use their bio: "${bio}" and include a reference to "${captions}". Keep it short and engaging. No greetings or signatures.`;

        const prompt2 = `Generate a professional and formal welcome message for ${username} (${email}). Use their bio: "${bio}" and include a reference to "${captions}". Keep it concise and business-like. No greetings or signatures.`;

        const response1 = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "user", content: prompt1 },
                { role: "system", content: "Provide only a single-sentence response without any greetings, signatures, or additional formatting." }
            ],
            max_tokens: 50,
            temperature: 0.7
        });

        const response2 = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "user", content: prompt2 },
                { role: "system", content: "Provide only a single-sentence response without any greetings, signatures, or additional formatting." }
            ],
            max_tokens: 50,
            temperature: 0.7
        });

        return {
            snippet1: response1.choices[0].message.content.trim(),
            snippet2: response2.choices[0].message.content.trim()
        };
    } catch (error) {
        console.error("Error generating email snippets:", error);
        throw error;
    }
}

export default generateEmailSnippets;
