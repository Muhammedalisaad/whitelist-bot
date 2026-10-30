//-/ Services
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

//-/ Config
const { DISCORD_TOKEN, API_KEY, ADMIN_IDS = "", PORT = 3000 } = process.env;
const FILE = `${process.env.DATA_DIR || "."}/whitelist.json`;
const admins = new Set(ADMIN_IDS.split(",").map((s) => s.trim()).filter(Boolean));

//-/ Storage
let whitelist = new Set();
try {
	whitelist = new Set(JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch {}

const save = () =>
	fs.writeFile(FILE, JSON.stringify([...whitelist]), (err) => err && console.error(err));

//-/ API
const app = express();

app.get("/check/:id", (req, res) => {
	if (req.get("x-api-key") !== API_KEY) return res.sendStatus(401);
	res.json({ whitelisted: whitelist.has(req.params.id) });
});

app.listen(PORT);

//-/ Bot
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.on("messageCreate", async (msg) => {
	if (msg.author.bot || !admins.has(msg.author.id)) return;

	const [cmd, id] = msg.content.trim().split(/\s+/);
	if (cmd !== "!whitelist" && cmd !== "!unwhitelist") return;
	if (!/^\d{1,16}$/.test(id ?? "")) return msg.reply(`Usage: ${cmd} <Roblox_UserID>`);

	try {
		if (cmd === "!whitelist") whitelist.add(id);
		else whitelist.delete(id);
		save();
		await msg.reply(`${cmd === "!whitelist" ? "Whitelisted" : "Removed"} \`${id}\``);
	} catch (err) {
		console.error(err);
	}
});

client.login(DISCORD_TOKEN);