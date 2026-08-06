// Import dependencies
import { Client, GatewayIntentBits, Events } from "discord.js";
import express from "express";
import 'dotenv/config'; // Load environment variables

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, 
        GatewayIntentBits.MessageContent 
    ],
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User
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

// REACTION ROLES
const { ReactionRole } = require('discordjs-reaction-role');

// Define your reaction role rules in an array
const config = [
    // Dynamics
    {
        messageId: '1534554590022860870', 
        reaction: '🚂',
        roleId: '1532030424690462932'
    },
        // Electronics
    {
        messageId: 'YOUR_MESSAGE_ID_1', // You can have multiple reactions on the same message
        reaction: '📡',
        roleId: '1532030780971155496'
    },
        // Electromagnets
    {
        messageId: 'YOUR_MESSAGE_ID_1', // You can have multiple reactions on the same message
        reaction: '🧲',
        roleId: '1532030669461389442'
    },
        //Power
    {
        messageId: 'YOUR_MESSAGE_ID_1', // You can have multiple reactions on the same message
        reaction: '⚡',
        roleId: '1532030584564744213'
    },
        // Software
    {
        messageId: 'YOUR_MESSAGE_ID_1', // You can have multiple reactions on the same message
        reaction: '<:ferris:1532084395320807595>',
        roleId: '1532030527660626130'
    },
    //Static
    {
        messageId: 'YOUR_MESSAGE_ID_1', // You can have multiple reactions on the same message
        reaction: '🛤️',
        roleId: '1532030964774080603'
    },

];

// Initialize the ReactionRole system
const rr = new ReactionRole(client, config);
// Log in to Discord with the token from your .env file
client.login(process.env.TOKEN);
