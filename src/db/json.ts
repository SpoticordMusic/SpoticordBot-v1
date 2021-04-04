import { JsonDB } from "node-json-db";
import { DB, DBRequest, DBToken } from ".";

export default class JSONPoweredDB implements DB {
    private db: JsonDB;

    async initialize(): Promise<boolean> {
        try {
            this.db = new JsonDB('db', true, false, '/');
        } catch {
            return false;
        }

        this.db.push('/requests', [], false);
        this.db.push('/tokens', {}, false);
        this.db.push('/userinfo', {}, false);
        
        return true;
    }

    async initializeLink(discordID: string): Promise<string> {
        let data = this.db.getObject<DBRequest[]>(`/requests`);
        let i = 0;

        // What the fuck is this
        if (data.find((d, _i) => {
            if (d.discordID == discordID) {
                i = _i;
                return true;
            }

            return false;
        })) return data[i].token;

        let token = makeid(32);
        this.db.push(`/requests`, [{
            discordID,
            token
        }], false);
    
        return token;
    }

    async updateAccessToken(discordID: string, accessToken: string): Promise<void> {
        const token = this.db.getObject<DBToken>(`/tokens/${discordID}`);
    
        token.spotifyAccessToken = accessToken;

        this.db.push(`/tokens/${discordID}`, token);
    }

    async getStoredTokens(): Promise<DBToken[]> {
        const obj = this.db.getObject<{[key: string]: DBToken}>('/tokens');
    
        return Object.keys(obj).map((objKey) => obj[objKey]);
    }

    async getToken(discordID: string): Promise<DBToken | null> {
        try {
            return this.db.getObject<DBToken>(`/tokens/${discordID}`);
        } catch {
            return null;
        }
    }

    async deleteToken(discordID: string): Promise<void> {
        this.db.delete(`/tokens/${discordID}`);
    }

    async getDeviceName(discordID: string): Promise<string> {
        this.makeSureUserinfo(discordID);

        return this.db.getData(`/userinfo/${discordID}/prefs/displayName`);
    }

    async setDeviceName(discordID: string, displayName: string): Promise<void> {
        this.makeSureUserinfo(discordID);

        this.db.push(`/userinfo/${discordID}/prefs/displayName`, displayName);
    }

    private makeSureUserinfo(discordID: string) {
        let coll = this.db.getObject('/userinfo');

        if (!coll) this.db.push('/userinfo', {});
        if (!coll) coll = {};

        if (coll[discordID]) return;

        this.db.push(`/userinfo/${discordID}`, {
            discordID,
            prefs: {
                displayName: 'Spoticord'
            }
        });
    }
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}