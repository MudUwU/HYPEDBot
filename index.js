// Import dependencies
import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import express from "express";
import 'dotenv/config'; // Load environment variables

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, 
        GatewayIntentBits.GuildMembers,
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

// ============================================
// REACTION ROLES - MANUAL IMPLEMENTATION
// ============================================

// Define your role mappings
const roleConfig = {
    '🚂': '1532030424690462932',      // Dynamics
    '📡': '1532030780971155496',      // Electronics
    '🧲': '1532030669461389442',      // Electromagnets
    '⚡': '1532030584564744213',      // Power
    '<:ferris:1532084395320807595>': '1532030527660626130', // Software
    '🛤️': '1532030964774080603'      // Static
};

// List of all exclusive role IDs
const exclusiveRoles = [
    '1532030424690462932', // Dynamics
    '1532030780971155496', // Electronics
    '1532030669461389442', // Electromagnets
    '1532030584564744213', // Power
    '1532030527660626130', // Software
    '1532030964774080603'  // Static
];

// The base role that everyone gets
const BASE_ROLE_ID = '1534912570262028308';

// The message ID where reactions will be used
const MESSAGE_ID = '1534554590022860870';

// Handle reaction additions
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot's own reactions
    if (user.bot) return;

    // Fetch the message if it's not cached
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    // Check if it's your specific message
    if (reaction.message.id !== MESSAGE_ID) return;

    // Get the emoji name (handle custom emojis)
    const emojiName = reaction.emoji.name;
    const emojiId = reaction.emoji.id;
    
    // Check if the emoji is in our config
    let roleId = roleConfig[emojiName];
    
    // If not found and it's a custom emoji, try with the full format
    if (!roleId && emojiId) {
        // Try to find by checking if any key contains the ID
        for (const [key, value] of Object.entries(roleConfig)) {
            if (key.includes(emojiId)) {
                roleId = value;
                break;
            }
        }
    }
    
    if (!roleId) return;

    // Get the guild and member
    const guild = reaction.message.guild;
    if (!guild) return;
    
    const member = await guild.members.fetch(user.id);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
        console.error(`Role ${roleId} not found`);
        return;
    }

    const baseRole = guild.roles.cache.get(BASE_ROLE_ID);
    if (!baseRole) {
        console.error(`Base role ${BASE_ROLE_ID} not found`);
        return;
    }

    // Check if user already has this role
    if (member.roles.cache.has(roleId)) {
        console.log(`${user.tag} already has ${role.name}`);
        return;
    }

    try {
        // Remove all other roles from the exclusive group
        for (const otherRoleId of exclusiveRoles) {
            if (otherRoleId !== roleId && member.roles.cache.has(otherRoleId)) {
                const otherRole = guild.roles.cache.get(otherRoleId);
                await member.roles.remove(otherRoleId);
                console.log(`✅ Removed ${otherRole?.name || 'unknown'} from ${user.tag}`);
            }
        }

        // Add the specific role
        await member.roles.add(role);
        console.log(`✅ Gave ${user.tag} the ${role.name} role`);

        // Add the base role (if they don't already have it)
        if (!member.roles.cache.has(BASE_ROLE_ID)) {
            await member.roles.add(baseRole);
            console.log(`✅ Gave ${user.tag} the ${baseRole.name} role`);
        }
    } catch (error) {
        console.error(`Error managing roles for ${user.tag}:`, error);
    }
});

// Handle reaction removals
client.on('messageReactionRemove', async (reaction, user) => {
    // Ignore bot's own reactions
    if (user.bot) return;

    // Fetch the message if it's not cached
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    // Check if it's your specific message
    if (reaction.message.id !== MESSAGE_ID) return;

    // Get the emoji name (handle custom emojis)
    const emojiName = reaction.emoji.name;
    const emojiId = reaction.emoji.id;
    
    // Check if the emoji is in our config
    let roleId = roleConfig[emojiName];
    
    // If not found and it's a custom emoji, try with the full format
    if (!roleId && emojiId) {
        for (const [key, value] of Object.entries(roleConfig)) {
            if (key.includes(emojiId)) {
                roleId = value;
                break;
            }
        }
    }
    
    if (!roleId) return;

    // Get the guild and member
    const guild = reaction.message.guild;
    if (!guild) return;
    
    const member = await guild.members.fetch(user.id);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
        console.error(`Role ${roleId} not found`);
        return;
    }

    const baseRole = guild.roles.cache.get(BASE_ROLE_ID);
    if (!baseRole) {
        console.error(`Base role ${BASE_ROLE_ID} not found`);
        return;
    }

    try {
        // Remove the specific role
        await member.roles.remove(role);
        console.log(`✅ Removed ${role.name} from ${user.tag}`);

        // Check if user has any other exclusive role
        let hasOtherExclusiveRole = false;
        for (const otherRoleId of exclusiveRoles) {
            if (member.roles.cache.has(otherRoleId)) {
                hasOtherExclusiveRole = true;
                break;
            }
        }

        // If they have no other exclusive roles, remove the base role too
        if (!hasOtherExclusiveRole) {
            await member.roles.remove(baseRole);
            console.log(`✅ Removed ${baseRole.name} from ${user.tag} (no exclusive roles left)`);
        }
    } catch (error) {
        console.error(`Error removing role from ${user.tag}:`, error);
    }
});

// Log in to Discord with the token from your .env file
client.login(process.env.TOKEN);
