import {
  ButtonInteraction,
  Client,
  Guild,
  GuildMember,
  Intents,
  Interaction,
  InteractionDeferReplyOptions,
  InteractionReplyOptions,
  Message,
  MessagePayload,
  TextBasedChannels,
  User,
  WebhookEditMessageOptions,
} from "discord.js";
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
import { ISCProvider } from "./provider";
import { APIApplicationCommandOption, APIMessage } from "@discordjs/builders/node_modules/discord-api-types";

export interface ICommand {
  data: SlashCommandBuilder;
  execute: (params: ICommandExec) => void;
  button?: (interaction: ButtonInteraction) => void;
  requires?: "guild"[];
}

export interface ICommandExec {
  user: User;
  guild: Guild;
  member: GuildMember;
  source: "chat" | "interaction";
  channel: TextBasedChannels;
  options: Map<string, any>;
  reply: (options: string | InteractionReplyOptions | MessagePayload) => Promise<void>;
  defer: (options?: InteractionDeferReplyOptions & { fetchReply: true }) => Promise<Message | APIMessage>;
  update: (options: string | MessagePayload | WebhookEditMessageOptions) => Promise<Message | APIMessage>;
}

interface SpoticordInitOpts<T extends ISCProvider> {
  provider: new (...args: any[] | undefined) => T;
  providerArgs: any[];
}

export default class Spoticord {
  public static config: ConfigManager;
  public static client: Client;
  public static database: DB;

  public static music_service: MusicPlayerService;
  public static linker_service: LinkerService;
  public static provider: ISCProvider;

  private static providerContructor: new (...args: any[] | undefined) => ISCProvider;
  private static providerArgs: any[];

  private static commands: Map<string, ICommand>;

  public static get token() {
    return this.config.get("token");
  }

  public static async initialize<T extends ISCProvider>(opts: SpoticordInitOpts<T>) {
    this.providerContructor = opts.provider;
    this.providerArgs = opts.providerArgs;

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
      intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES],
    });

    this.client.on("ready", this.onClientReady);
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

    console.log("[INFO] Discord ready, starting Provider initialization...");

    if (this.providerArgs) this.provider = new this.providerContructor(...this.providerArgs);
    else this.provider = new this.providerContructor();

    console.log(`[INFO] Lavalink initialized, starting Spotify initialization`);

    this.music_service = new MusicPlayerService();

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

      let requiredCommands = [...this.commands.values()];

      const resp = (await rest.get(Routes.applicationCommands(this.client.user.id))) as {
        name: string;
        description: string;
        options: APIApplicationCommandOption[];
      }[];

      let needsRefresh = false;

      for (const remoteCommand of resp) {
        const reqCommand = requiredCommands.filter((e) => e.data.name === remoteCommand.name)[0];
        if (reqCommand) {
          if ((reqCommand.data.options || []).length !== (remoteCommand.options || []).length) {
            needsRefresh = true;
            break;
          }

          if (remoteCommand.options) {
            for (const option of remoteCommand.options) {
              const localOption = reqCommand.data.options.filter((o) => o.toJSON().name === option.name)[0]?.toJSON();

              if (!localOption) {
                needsRefresh = true;
                break;
              }

              if (
                localOption.name !== option.name ||
                localOption.type !== option.type ||
                localOption.description !== option.description ||
                localOption.required !== option.required ||
                localOption.default !== option.default
              ) {
                needsRefresh = true;
                break;
              }
            }
          }
        } else {
          needsRefresh = true;
          break;
        }
      }

      if (needsRefresh) {
        await rest.put(
          Routes.applicationCommands(this.client.user.id) /* what the fuck TypeScript?? */ as unknown as `/${string}`,
          { body: commands }
        );
      }
    } catch (error) {
      throw error;
    }
  }

  private static readonly GUILD_REQ_RESPONSES = [
    "Please I beg you please to run this command in a server :pray:",
    "Dude are you fr trying to run this command in DMs??",
    ":clown:",
    "A fatal error has occured while trying to execute this command: **Run this command in a server!**",
    "*Hey psst? Can I tell you a secret? Okay, so I heard the other day that this command must be run inside a server :open_mouth:*",
    "Which server bro?",
    "Hey hello yes I just heard that you found an easter egg, oh and I also heard you should **EXECUTE THIS COMMAND IN A SERVER**",
    "Sup",
    "?????????????????",
    'Yo if you know any more "funny" responses please tell me :>',
    "Wie dit leest is gek",
    "Shoutout to everyone who sees this on GitHub before they receive this from the bot!",
    "You sending this command in DMs is like as useful as throwing a brick into a burning building",
    "Have you heard about this **AMAZING NEW FEATURE** called **SERVERS**?? YES!! They exist! And maybe you should execute this command in one!",
  ];

  private static async onInteraction(interaction: Interaction) {
    if (interaction.isCommand()) {
      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      if (command.requires?.includes("guild") && !interaction.guild) {
        return await interaction.reply({
          content: Spoticord.GUILD_REQ_RESPONSES[Math.floor(Math.random() * Spoticord.GUILD_REQ_RESPONSES.length)],
        });
      }

      if (command.requires?.includes("guild") && !interaction.member) {
        return await interaction.reply({
          content: "Fatal error: Command requires guild, guild was provided but member is undefined?! **please report this!**",
        });
      }

      command.execute({
        user: interaction.user,
        guild: interaction.guild,
        member: interaction.member as GuildMember,
        source: "interaction",
        reply: interaction.reply.bind(interaction),
        defer: interaction.deferReply.bind(interaction),
        update: interaction.editReply.bind(interaction),
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
