import { DB, DBToken } from ".";

export default class MongoPoweredDB implements DB {
    async initialize(): Promise<boolean> {
        return false;
    }

    async initializeLink(discordID: string): Promise<string> {
        return "";
    }

    async updateAccessToken(discordID: string, accessToken: string): Promise<void> {
    }

    async getStoredTokens(): Promise<DBToken[]> {
        return [];
    }

    async getToken(discordID: string): Promise<DBToken> {
        return {discordID: '', spotifyAccessToken: '', spotifyRefreshToken: ''}
    }

    async deleteToken(discordID: string): Promise<void> {
    }

    async getDeviceName(discordID: string): Promise<string> {
        return "";
    }

    async setDeviceName(discordID: string, displayName: string): Promise<void> {
    }
}