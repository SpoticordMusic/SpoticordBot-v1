import { SDC, TokenManager } from "@spoticord/nodesdc";
import axios, { AxiosRequestConfig } from "axios";

type UserState = 'CONNECTING' | 'IDLE' | 'ACTIVE';

interface RestOptions {
  method: 'GET' | 'PUT' | 'POST';
  authorization: boolean;
  path: string;
  body?: any;
  headers?: Map<string, string> | { [key: string]: string }
}

export default class GenericUser {
  private readonly token: TokenManager;
  
  public constructor(public readonly userId: string, public readonly dealer: SDC, public state: UserState) {
    this.token = dealer.getTokenManager();
  }
  
  public async playTrack(uri: string) {
    return (await this.rest({
      method: 'PUT',
      authorization: true,
      path: '/me/player/play',
      body: {
        uris: [uri]
      }
    })).status === 204;
  }

  public async pausePlayback() {
    return (await this.rest({
      method: 'PUT',
      authorization: true,
      path: '/me/player/pause'
    })).status === 204;
  }

  public async resumePlayback() {
    return (await this.rest({
      method: 'PUT',
      authorization: true,
      path: '/me/player/play'
    })).status === 204;
  }

  public async seekPlayback(position: number) {
    return (await this.rest({
      method: 'PUT',
      authorization: true,
      path: `/me/player/seek?position_ms=${position}`
    })).status === 204;
  }

  public async setSpoticordDevice() {
    return (await this.rest({
      method: 'PUT',
      path: '/me/player',
      authorization: true,
      body: {
        device_ids: [this.dealer.getDeviceID()]
      }
    })).status === 204;
  }

  private async rest(opts: RestOptions) {
    return await axios.request(await this.buildAxiosOpts(opts));
  }

  private async buildAxiosOpts(opts: RestOptions): Promise<AxiosRequestConfig> {
    return {
      method: opts.method,
      url: `https://api.spotify.com/v1${opts.path}`,
      headers: {
        Authorization: opts.authorization ? `Bearer ${await this.token.retrieveToken()}` : undefined,
        ...this.mapToObj(opts.headers)
      },
      data: opts.body,
      validateStatus: _ => true
    }
  };

  private mapToObj(map: Map<string, string> | { [key: string]: string }) {
    return map instanceof Map ? Object.fromEntries(map) : map;
  }
}