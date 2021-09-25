import {
  ButtonInteraction,
  Client,
  CommandInteraction,
  CommandInteractionOption,
  Guild,
  GuildMember,
  Intents,
  Interaction,
  InteractionReplyOptions,
  Message,
  MessagePayload,
  TextBasedChannels,
  TextChannel,
  User,
} from "discord.js";
import { Manager, NodeOptions } from "erela.js";
import ConfigManager from "../config";
import { DB } from "../db";
import JSONPoweredDB from "../db/json";
import MongoPoweredDB from "../db/mongo";
import LinkerService from "./linker";
import MusicPlayerService from "./music";
import SpoticordRealtime from "./realtime";
import fs from "fs";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { SlashCommandBuilder } from "@discordjs/builders";

interface ICommand {
  data: SlashCommandBuilder;
  execute: (params: ICommandExec) => void;
  button?: (interaction: ButtonInteraction) => void;
}

export interface ICommandExec {
  user: User;
  member: GuildMember;
  source: "chat" | "interaction";
  channel: TextBasedChannels;
  options: Map<string, any>;
  reply: (options: string | InteractionReplyOptions | MessagePayload) => Promise<void>;
}

export default class Spoticord {
  public static config: ConfigManager;
  public static client: Client;
  public static database: DB;

  public static music_service: MusicPlayerService;
  public static linker_service: LinkerService;

  private static commands: Map<string, ICommand>;

  public static get token() {
    return this.config.get("token");
  }

  public static async initialize() {
    this.onClientReady = this.onClientReady.bind(this);

    this.config = new ConfigManager();

    if (this.config.getDirty()) {
      console.error("[FATAL] A dirty (or nonexistant) config.json file was found, please generate a new one");
      throw this.config.getDirty();
    }

    const dbConfig = this.config.get("database");

    switch (dbConfig.strategy) {
      case "mongo":
        this.database = new MongoPoweredDB(
          `mongodb://${dbConfig.username}:${encodeURIComponent(dbConfig.password)}@${dbConfig.host}:${dbConfig.port}/`,
          dbConfig.db
        );
        break;

      case "json":
        this.database = new JSONPoweredDB(dbConfig.filename);
        break;

      default:
        throw new Error(`Unknown database strategy: ${dbConfig.strategy}`);
    }

    this.client = new Client({
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES],
    });

    this.client.on("ready", this.onClientReady);
    this.client.on("message", this.onClientMessage.bind(this));
    this.client.on("interactionCreate", this.onInteraction.bind(this));
    this.client.on("guildCreate", this.onGuildJoined);
    this.client.on("guildDelete", this.onGuildLeft);

    if (!(await this.database.initialize())) throw new Error("Failed to initialize database");

    console.log("[INFO] Database initialized, starting Linking service...");

    this.linker_service = new LinkerService();
    if (!(await this.linker_service.initialize())) throw new Error("Failed to initialize linking service");

    console.log("[INFO] Linking service initialized, starting Discord initialization...");
    this.client.login(this.token);
  }

  public static destroy() {
    this.client.destroy();
  }

  private static async onClientReady() {
    await this.registerSlashCommands();

    await this.client.user.setActivity({
      name: "Spotify songs 🤪",
    });

    console.log("[INFO] Discord ready, starting Lavalink initialization...");

    const manager = new Manager({
      nodes: this.config.get("nodes") as NodeOptions[],
      send: (id, payload) => {
        const guild = this.client.guilds.cache.get(id);
        guild && guild.shard.send(payload);
      },
      shards: 1,
    });

    manager.init(this.client.user.id);
    this.client.on("raw", (d) => manager.updateVoiceState(d));

    console.log(`[INFO] Lavalink initialized, starting Spotify initialization`);

    this.music_service = new MusicPlayerService(manager);

    if (this.config.get("realtime")) {
      console.log("[INFO] Spotify initialized, starting Realtime server...");
      SpoticordRealtime.startRealtimeService(this.config.get("realtime").port, this.config.get("realtime").host);
    }

    console.log("[INFO] Initialization completed");
  }

  private static async registerSlashCommands() {
    this.commands = new Map<string, ICommand>();

    const getCommandFiles = (dir: string): string[] => {
      const fsEntries = fs.readdirSync(dir).map((entry) => `${dir}/${entry}`);

      let files = fsEntries.filter((entry) => entry.endsWith(".js")).map((entry) => fs.realpathSync(entry));

      for (const entry of fsEntries) {
        if (fs.statSync(entry).isDirectory()) files.push(...getCommandFiles(entry));
      }

      return files;
    };

    const commands = [];
    const commandFiles = getCommandFiles(`${__dirname}/../commands`);

    for (const file of commandFiles) {
      const command = require(file).default as ICommand;
      commands.push(command.data.toJSON());
      this.commands.set(command.data.name, command);
    }

    const rest = new REST({ version: "9" }).setToken(this.token);

    try {
      console.log("[INFO] Start refresh of slash commands");

      await rest.put(
        Routes.applicationCommands(
          this.client.user.id
        ) /* what the fuck TypeScript?? */ as unknown as `/${string}`,
        { body: commands }
      );
    } catch (error) {
      throw error;
    }
  }

  private static async onClientMessage(message: Message) {
    if (!message.guild) return;
    if (!message.content.startsWith(this.config.get("prefix"))) return;

    const args = message.content.substr(1).split(" ");
    const cmd = args.shift().toLowerCase();

    console.debug(`[CMD] ${cmd} -> ${args.map((a) => `"${a}"`).join(" ")}`);

    const command = this.commands.get(cmd);
    if (!command) return;

    if (command.data.options.length > 1) return;

    command.execute({
      user: message.author,
      member: message.member,
      source: 'chat',
      reply: (...params): Promise<void> => {
        return new Promise(resolve => {
          message.reply(...params).then(() => resolve());
        });
      },
      channel: message.channel,
      options: new Map(command.data.options.length ? [[command.data.options[0].toJSON().name, args.join(' ')]] : [])
    })
  }

  private static async onInteraction(interaction: Interaction) {
    if (interaction.isCommand()) {
      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      command.execute({
        user: interaction.user,
        member: interaction.member as GuildMember,
        source: "interaction",
        reply: interaction.reply.bind(interaction),
        channel: interaction.channel,
        options: new Map(interaction.options.data.map((i) => [i.name, i.value])),
      });
    } else if (interaction.isButton()) {
      const command = this.commands.get(interaction.customId.split("::")[0]);
      if (!command) return;

      command.button(interaction);
    }
  }

  private static async onGuildJoined(guild: Guild) {
    console.log(`[INFO] Joined guild "${guild.name}"`);
  }

  private static async onGuildLeft(guild: Guild) {
    console.log(`[INFO] Left guild "${guild.name}"`);
  }
}
