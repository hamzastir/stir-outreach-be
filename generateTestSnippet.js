import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function generateEmailSnippets(username, captions, bio) {
  try {
    const prompt1 = `
      Give me just the personalized section of the email to an influencer, keeping the tone natural and human-like. The copy should feel like it was written by a person, not AI. Limit the personalised section to 2-3 lines and keep it relevant to the rest of the email. The language should be American English. Use the following data to personalise the personalized section.

Things to keep in mind:
a. Don't just straightaway mention what their previous posts were all about, what movies/series they mentioned - every damn time. Rather consider the language and depth in their captions. 
b. Mention things that set them apart
c. Keep it super human and tell them how we are a good fit for each other, without making it repetitive, redundant and salesy.
d. for example for Cindy we can write how she balances her feed by keeping some posts informative and some fun oriented.
e. Give me only the personalised message part — 2-3 lines. Opening greetings and rest of the body shouldn't be part of the final output 
f. Use conversational phrases to avoid overly polished language and add warmth.
g. Only talk about the content available on their insta handle and do not consider websites and other redirections


Generic Email Template:

Hi [Name], I’m Yug

[Personalised 2-3 lines based on provided data.]

I wanted to reach out because we’re building something exciting at Stir. It’s an invite-only platform designed specifically for film influencers like you. It gives early access to upcoming releases and direct collaboration opportunities with indie filmmakers and major studios.

Here’s what makes Stir unique:
A flat 10% take rate—no hidden fees or subscriptions.
Easy-to-use tools to streamline collaborations with filmmakers.
Curated matchmaking to connect you with the right industry partners.

I’d love to hear your thoughts and see if this is something you’d like to explore. No pressure ofcourse—feel free to reply to this email or set up a quick call here: [calendly link].

If you’re ready to dive in, you can also onboard directly here: [onboarding link].

Looking forward to hearing from you!

Best,
Yug

PS: @filmtvrate, @munyrags + 23 others have recently got their exclusive access to Stir!

—

Here’s a sample influencer data and desired output for example:

Influencer Data:
Name: Cindy Tang
Instagram Handle: https://www.instagram.com/filmtvrate
Bio: a celebration of cinematic history
bringing comfort through film, tv & music
Category: Film influencer
Captions from Last 4 Posts:
Are they lovers? Worse. II happy love week! to celebrate, I’m listing some of the most uniquely loved ships by fandoms that hurt too good. I had full faith that these ships SHOULD have been together… many of these are requested by you, and I can’t wait to hear more of your ships. ❤‍🩹Q: Which couple is your “Are they lovers? Worse.”
⁠⁠Music of Winter Films & TV ❄🎼✨these are some of my favourite music that REMINDS me of winter, the feeling of winter, the chill of winter. it’s crisp, magical, and with hints of snowfall i can’t quite explain. just close your eyes, and hear it for yourself. 🤍i’m curious to know however: Q: What music reminds you of Winter?
⁠⁠la la land (2016) - the look of LOVE. 💜 “I’m always gonna love you.” hits different when you know the ending to this film. it shows that even in alternate versions of our lives, we think about what could have been. and more realistically: letting go of what could be 🤍.how beautiful, for #lalaland to give us that bittersweet heartfelt ending? one that will always be remembered. Q: Which La La Land moment was your favourite?
Iconic Squid Game Characters as Croissants II 🥐✨you asked? we’ll deliver! fresh from the oven, are 9 new Squid Game Croissants served in character form. quick! eat it before it’s cold. 🤍@dizzypumpkinart and I partnered together again to have these croissants special made for you and your favourite characters ;). shoutout to @squidgamenetflix & @squidgameunleashed for making our day by supporting our previous post 🎀 this one’s for you! Q: Which Squid Game croissant is your favourite?

Email:

Hi Cindy, I’m Yug,

I’ve been following Film TV Rate for a while now. I loved your “La La Land” post—the way you described the ending was so heartfelt. Also, the Squid Game croissants? That was such a fun and creative idea! I absolutely love the way you celebrate cinematic history—it’s such a comforting escape for film lovers like me.

I wanted to reach out because we’re building something exciting at Stir. It’s an invite-only platform designed specifically for film influencers like you. It gives early access to upcoming releases and direct collaboration opportunities with indie filmmakers and major studios.

Here’s what makes Stir unique:
A flat 10% take rate—no hidden fees or subscriptions.
Easy-to-use tools to streamline collaborations with filmmakers.
Curated matchmaking to connect you with the right industry partners.

I’d love to hear your thoughts and see if this is something you’d like to explore. No pressure—feel free to reply to this email or set up a quick call here: [calendly link].

If you’re ready to dive in, you can also onboard directly here: [onboarding link].

Looking forward to hearing from you!

Best,
Yug

—    
        Influencer Data:
        - Name: ${username}
        - Bio: "${bio}"
        - Captions from last 5 posts: "${captions}"`;

    const response1 = await openai.chat.completions.create({
      model: "o1-mini",
      messages: [{ role: "user", content: prompt1 }],
    });
    return response1.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("Error generating email snippets:", error);
    throw error;
  }
}

export default generateEmailSnippets;
