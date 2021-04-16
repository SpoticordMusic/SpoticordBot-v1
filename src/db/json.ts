import { JsonDB } from "node-json-db";
import { DB, DBRequest, DBToken } from ".";

export default class JSONPoweredDB implements DB {
    private db: JsonDB;

    constructor(private filename: string) {}

    async initialize(): Promise<boolean> {
        try {
            this.db = new JsonDB(this.filename, true, false, '/');
        } catch {
            return false;
        }

        this.db.push('/requests', [], false);
        this.db.push('/tokens', {}, false);
        this.db.push('/userinfo', {}, false);
        
        return true;
    }

    async initializeLink(discord_id: string): Promise<string> {
        let data = this.db.getObject<DBRequest[]>(`/requests`);
        let i = 0;

        // What the fuck is this
        if (data.find((d, _i) => {
            if (d.discord_id == discord_id) {
                i = _i;
                return true;
            }

            return false;
        })) return data[i].token;

        let token = makeid(32);
        this.db.push(`/requests`, <DBRequest[]>[{
            discord_id,
            token
        }], false);
    
        return token;
    }

    async getLink(token: string): Promise<DBRequest | null> {
        let data = this.db.getObject<DBRequest[]>(`/requests`);
        let i = 0;

        // And again, this shitshow of a function
        if (data.find((d, _i) => {
            if (d.token == token) {
                i = _i;
                return true;
            }

            return false;
        })) return data[i];

        return null;
    }

    async deleteLink(token: string): Promise<void> {
        let data = this.db.getObject<DBRequest[]>(`/requests`);
        let i = 0;

        // And again, this shitshow of a function
        if (data.find((d, _i) => {
            if (d.token == token) {
                i = _i;
                return true;
            }

            return false;
        })) this.db.delete(`/requests[${i}]`);
    }

    async insertToken(discord_id: string, access_token: string, refresh_token: string): Promise<void> {        
        this.db.push(`/tokens/${discord_id}`, <DBToken>{
            discord_id,
            access_token,
            refresh_token
        });
    }

    async updateAccessToken(discord_id: string, access_token: string): Promise<void> {
        const token = this.db.getObject<DBToken>(`/tokens/${discord_id}`);
    
        token.access_token = access_token;

        this.db.push(`/tokens/${discord_id}`, token);
    }

    async getStoredTokens(): Promise<DBToken[]> {
        const obj = this.db.getObject<{[key: string]: DBToken}>('/tokens');
    
        return Object.keys(obj).map((objKey) => obj[objKey]);
    }

    async getToken(discord_id: string): Promise<DBToken | null> {
        try {
            return this.db.getObject<DBToken>(`/tokens/${discord_id}`);
        } catch {
            return null;
        }
    }

    async deleteToken(discord_id: string): Promise<void> {
        this.db.delete(`/tokens/${discord_id}`);
    }

    async getDeviceName(discord_id: string): Promise<string> {
        this.makeSureUserinfo(discord_id);

        return this.db.getData(`/userinfo/${discord_id}/prefs/display_name`);
    }

    async setDeviceName(discord_id: string, display_name: string): Promise<void> {
        this.makeSureUserinfo(discord_id);

        this.db.push(`/userinfo/${discord_id}/prefs/display_name`, display_name);
    }

    private makeSureUserinfo(discord_id: string) {
        let coll = this.db.getObject('/userinfo');

        if (!coll) this.db.push('/userinfo', {});
        if (!coll) coll = {};

        if (coll[discord_id]) return;

        this.db.push(`/userinfo/${discord_id}`, {
            discord_id,
            prefs: {
                display_name: 'Spoticord'
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