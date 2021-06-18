import { Client } from "discord.js";
import MusicPlayerService from "./music";
import express, { Express, Request, Response } from 'express';

export default class SpoticordRealtime {
  private static app: Express;
  private static discord: Client;
  private static music: MusicPlayerService;

  public static startRealtimeService(port: number, host: string, discord: Client, music: MusicPlayerService): void {
    this.app = express();
    this.discord = discord;
    this.music = music;

    this.app.get('/servercount', this.getServerCount.bind(this));
    this.app.get('/servers', this.getServers.bind(this));
    this.app.get('/server/:id', this.getServer.bind(this));

    this.app.get('/playercount', this.getPlayerCount.bind(this));

    this.app.listen(port, host);
  }

  private static getServerCount(req: Request, res: Response) {
    res.json({
      count: this.discord.guilds.cache.size
    });
  }

  private static getServers(req: Request, res: Response) {
    res.json({
      servers: this.discord.guilds.cache.map(guild => guild.id)
    });
  }

  private static getServer(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({error: 'Invalid request'});

    const guild = this.discord.guilds.cache.get(req.params.id);
    res.status(guild ? 200 : 404).json(guild ?? {error: 'Guild not found'});
  }

  private static getPlayerCount(req: Request, res: Response) {
    res.json({
      count: this.music.getPlayers().length
    });
  }
}