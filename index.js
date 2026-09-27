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

// Shared member role granted alongside base roles on both messages
const SHARED_MEMBER_ROLE_ID = '1533741150697951334';

// ============================================
// QUEUE SYSTEM
// ============================================

// Queue to store pending reactions
const reactionQueue = [];
let isProcessing = false;

// Helper function to add a reaction to the queue
function addToQueue(reaction, user, isRemove = false) {
    return new Promise((resolve, reject) => {
        reactionQueue.push({
            reaction,
            user,
            isRemove,
            resolve,
            reject,
            timestamp: Date.now()
        });
        console.log(`📥 Queued ${isRemove ? 'removal' : 'addition'} for ${user.tag}`);
        processQueue(); // Start processing if not already
    });
}

// Main queue processor
async function processQueue() {
    // If already processing or queue is empty, stop
    if (isProcessing || reactionQueue.length === 0) return;

    isProcessing = true;
    console.log(`🔄 Processing queue (${reactionQueue.length} items)`);

    try {
        // Get the next item from the queue
        const item = reactionQueue.shift();
        const { reaction, user, isRemove, resolve, reject } = item;

        try {
            // Process the reaction
            if (isRemove) {
                await handleReactionRemove(reaction, user);
            } else {
                await handleReactionAdd(reaction, user);
            }
            resolve();
        } catch (error) {
            console.error(`Error processing reaction for ${user.tag}:`, error);
            reject(error);
        }

        // After processing, check if there are more items
        // Small delay to prevent rate limiting
        setTimeout(() => {
            isProcessing = false;
            processQueue(); // Process next item
        }, 200); // 200ms delay between each reaction

    } catch (error) {
        console.error('Queue processing error:', error);
        isProcessing = false;
        processQueue(); // Try to continue
    }
}

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

        // Add the shared member role if not already present
        const sharedRole = guild.roles.cache.get(SHARED_MEMBER_ROLE_ID);
        if (sharedRole && !member.roles.cache.has(SHARED_MEMBER_ROLE_ID)) {
            await member.roles.add(sharedRole);
            console.log(`✅ Gave ${user.tag} the ${sharedRole.name} role`);
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

            // Remove the shared member role only if they have no non-tech roles either
            let hasAnyNonTechExclusive = false;
            for (const nonTechRoleId of nonTechExclusiveRoles) {
                if (member.roles.cache.has(nonTechRoleId)) {
                    hasAnyNonTechExclusive = true;
                    break;
                }
            }

            if (!hasAnyNonTechExclusive) {
                const sharedRole = guild.roles.cache.get(SHARED_MEMBER_ROLE_ID);
                if (sharedRole && member.roles.cache.has(SHARED_MEMBER_ROLE_ID)) {
                    await member.roles.remove(sharedRole);
                    console.log(`✅ Removed ${sharedRole.name} from ${user.tag} (no roles left)`);
                }
            }
        }
    } catch (error) {
        console.error(`Error removing role from ${user.tag}:`, error);
    }
});


// ============================================
// SECOND MESSAGE - NON-TECH ROLES
// ============================================

// Define role mappings for the second message
const nonTechRoleConfig = {
    '🌐': '1553783737068822700',      // Marketing
    '💸': '1553783753288056973',      // Sponsorship
    '🧪': '1536463945064390756',      // Research
    '🧑‍🏫': '1553785466749460693'    // Outreach
};

// List of all exclusive non-tech role IDs
const nonTechExclusiveRoles = [
    '1553783737068822700', // Marketing
    '1553783753288056973', // Sponsorship
    '1536463945064390756', // Research
    '1553785466749460693' // Outreach
];

// The base role for non-tech members
const NON_TECH_BASE_ROLE_ID = '1532031060962185367';

// The second message ID
const NON_TECH_MESSAGE_ID = '1536784336194375680';

// ============================================
// NON-TECH QUEUE SYSTEM
// ============================================

const nonTechQueue = [];
let isNonTechProcessing = false;

function addToNonTechQueue(reaction, user, isRemove = false) {
    return new Promise((resolve, reject) => {
        nonTechQueue.push({
            reaction,
            user,
            isRemove,
            resolve,
            reject,
            timestamp: Date.now()
        });
        console.log(`📥 Queued non-tech ${isRemove ? 'removal' : 'addition'} for ${user.tag}`);
        processNonTechQueue();
    });
}

async function processNonTechQueue() {
    if (isNonTechProcessing || nonTechQueue.length === 0) return;

    isNonTechProcessing = true;
    console.log(`🔄 Processing non-tech queue (${nonTechQueue.length} items)`);

    try {
        const item = nonTechQueue.shift();
        const { reaction, user, isRemove, resolve, reject } = item;

        try {
            if (isRemove) {
                await handleNonTechReactionRemove(reaction, user);
            } else {
                await handleNonTechReactionAdd(reaction, user);
            }
            resolve();
        } catch (error) {
            console.error(`Error processing non-tech reaction for ${user.tag}:`, error);
            reject(error);
        }

        setTimeout(() => {
            isNonTechProcessing = false;
            processNonTechQueue();
        }, 200);
    } catch (error) {
        console.error('Non-tech queue processing error:', error);
        isNonTechProcessing = false;
        processNonTechQueue();
    }
}

// Handle non-tech reaction additions
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    // Only handle the non-tech message
    if (reaction.message.id !== NON_TECH_MESSAGE_ID) return;

    await addToNonTechQueue(reaction, user, false);
});

// Handle non-tech reaction removals
client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    if (reaction.message.id !== NON_TECH_MESSAGE_ID) return;

    await addToNonTechQueue(reaction, user, true);
});

// Core logic: add non-tech role
async function handleNonTechReactionAdd(reaction, user) {
    const emojiName = reaction.emoji.name;
    const emojiId = reaction.emoji.id;

    let roleId = nonTechRoleConfig[emojiName];

    if (!roleId && emojiId) {
        for (const [key, value] of Object.entries(nonTechRoleConfig)) {
            if (key.includes(emojiId)) {
                roleId = value;
                break;
            }
        }
    }

    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
        console.error(`Non-tech role ${roleId} not found`);
        return;
    }

    const baseRole = guild.roles.cache.get(NON_TECH_BASE_ROLE_ID);
    if (!baseRole) {
        console.error(`Non-tech base role ${NON_TECH_BASE_ROLE_ID} not found`);
        return;
    }

    // Check if user already has this role
    if (member.roles.cache.has(roleId)) {
        console.log(`${user.tag} already has ${role.name}`);
        return;
    }

    try {
        // Remove all other exclusive non-tech roles
        for (const otherRoleId of nonTechExclusiveRoles) {
            if (otherRoleId !== roleId && member.roles.cache.has(otherRoleId)) {
                const otherRole = guild.roles.cache.get(otherRoleId);
                await member.roles.remove(otherRoleId);
                console.log(`✅ Removed ${otherRole?.name || 'unknown'} from ${user.tag}`);
            }
        }

        // Add the specific role
        await member.roles.add(role);
        console.log(`✅ Gave ${user.tag} the ${role.name} role`);

        // Add the non-tech base role if not already present
        if (!member.roles.cache.has(NON_TECH_BASE_ROLE_ID)) {
            await member.roles.add(baseRole);
            console.log(`✅ Gave ${user.tag} the ${baseRole.name} role`);
        }

        // Add the shared member role if not already present
        const sharedRole = guild.roles.cache.get(SHARED_MEMBER_ROLE_ID);
        if (sharedRole && !member.roles.cache.has(SHARED_MEMBER_ROLE_ID)) {
            await member.roles.add(sharedRole);
            console.log(`✅ Gave ${user.tag} the ${sharedRole.name} role`);
        }
    } catch (error) {
        console.error(`Error managing non-tech roles for ${user.tag}:`, error);
    }
}

// Core logic: remove non-tech role
async function handleNonTechReactionRemove(reaction, user) {
    const emojiName = reaction.emoji.name;
    const emojiId = reaction.emoji.id;

    let roleId = nonTechRoleConfig[emojiName];

    if (!roleId && emojiId) {
        for (const [key, value] of Object.entries(nonTechRoleConfig)) {
            if (key.includes(emojiId)) {
                roleId = value;
                break;
            }
        }
    }

    if (!roleId) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
        console.error(`Non-tech role ${roleId} not found`);
        return;
    }

    const baseRole = guild.roles.cache.get(NON_TECH_BASE_ROLE_ID);
    if (!baseRole) {
        console.error(`Non-tech base role ${NON_TECH_BASE_ROLE_ID} not found`);
        return;
    }

    try {
        // Remove the specific role
        await member.roles.remove(role);
        console.log(`✅ Removed ${role.name} from ${user.tag}`);

        // Check if user still has any other exclusive non-tech role
        let hasOtherExclusiveRole = false;
        for (const otherRoleId of nonTechExclusiveRoles) {
            if (member.roles.cache.has(otherRoleId)) {
                hasOtherExclusiveRole = true;
                break;
            }
        }

        // If no other exclusive roles, remove the base role too
           // If they have no other exclusive roles, remove the base role too
        if (!hasOtherExclusiveRole) {
            await member.roles.remove(baseRole);
            console.log(`✅ Removed ${baseRole.name} from ${user.tag} (no exclusive roles left)`);

            // Remove the shared member role only if they have no tech roles either
            let hasAnyTechExclusive = false;
            for (const techRoleId of exclusiveRoles) {
                if (member.roles.cache.has(techRoleId)) {
                    hasAnyTechExclusive = true;
                    break;
                }
            }

            if (!hasAnyTechExclusive) {
                const sharedRole = guild.roles.cache.get(SHARED_MEMBER_ROLE_ID);
                if (sharedRole && member.roles.cache.has(SHARED_MEMBER_ROLE_ID)) {
                    await member.roles.remove(sharedRole);
                    console.log(`✅ Removed ${sharedRole.name} from ${user.tag} (no roles left)`);
                }
            }
        }
    } catch (error) {
        console.error(`Error removing non-tech role from ${user.tag}:`, error);
    }
}
// Log in to Discord with the token from your .env file
client.login(process.env.TOKEN);
