//-/ Services
require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require("discord.js");

//-/ Config
const { DISCORD_TOKEN, API_KEY, ADMIN_IDS = "", STORAGE_CHANNEL_ID, PORT = 3000 } = process.env;
const admins = new Set(ADMIN_IDS.split(",").map((s) => s.trim()).filter(Boolean));

//-/ State
const whitelist = new Set();
let channel;
let lastMessage;
let loaded = false;
let queue = Promise.resolve();

//-/ Client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

//-/ Storage
const load = async () => {
	const messages = await channel.messages.fetch({ limit: 25 });
	lastMessage = messages.find((m) => m.author.id === client.user.id && m.attachments.size > 0);
	if (lastMessage) {
		const res = await fetch(lastMessage.attachments.first().url);
		for (const id of await res.json()) whitelist.add(String(id));
	}
	loaded = true;
};

const persist = async () => {
	const previous = lastMessage;
	lastMessage = await channel.send({
		files: [
			new AttachmentBuilder(Buffer.from(JSON.stringify([...whitelist])), {
				name: "whitelist.json",
			}),
		],
	});
	if (previous) await previous.delete().catch(() => {});
};

const save = () => (queue = queue.then(persist));

//-/ API
const app = express();

app.get("/", (_, res) => res.send("ok"));

app.get("/check/:id", (req, res) => {
	if (req.get("x-api-key") !== API_KEY) return res.sendStatus(401);
	if (!loaded) return res.sendStatus(503);
	res.json({ whitelisted: whitelist.has(req.params.id) });
});

app.listen(PORT);

//-/ Bot
client.once(Events.ClientReady, async () => {
	try {
		channel = await client.channels.fetch(STORAGE_CHANNEL_ID);
		await load();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
});

client.on("messageCreate", async (msg) => {
	if (msg.author.bot || !loaded || !admins.has(msg.author.id)) return;

	const [cmd, id] = msg.content.trim().split(/\s+/);
	if (cmd !== "!whitelist" && cmd !== "!unwhitelist") return;
	if (!/^\d{1,16}$/.test(id ?? "")) return msg.reply(`Usage: ${cmd} <Roblox_UserID>`);

	try {
		if (cmd === "!whitelist") whitelist.add(id);
		else whitelist.delete(id);
		await save();
		await msg.reply(`${cmd === "!whitelist" ? "Whitelisted" : "Removed"} \`${id}\``);
	} catch (err) {
		console.error(err);
		msg.reply("Save failed").catch(() => {});
	}
});

client.login(DISCORD_TOKEN);
