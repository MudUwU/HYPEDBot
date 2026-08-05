// Import dependencies
import { Client, GatewayIntentBits, Events } from "discord.js";
import express from "express";
import 'dotenv/config'; // Load environment variables

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Needed to read message content
    ]
});

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// A simple health check endpoint for Render
app.get("/", (req, res) => {
    res.send("Bot is alive!");
});

app.listen(port, () => {
    console.log(`Web server is ready on port ${port}`);
});

// Log when the bot is ready
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Logged in as ${c.user.tag}!`);
});

// A simple ping command
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
});

// Log in to Discord with the token from your .env file
client.login(process.env.TOKEN);
