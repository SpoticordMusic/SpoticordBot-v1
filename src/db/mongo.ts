import { DB, DBRequest, DBToken } from ".";
import {Db, MongoClient} from 'mongodb';

export default class MongoPoweredDB implements DB {
    private client: MongoClient;
    private db: Db;

    constructor(private connection_string: string, private database: string) {}

    async initialize(): Promise<boolean> {
        this.client = new MongoClient(this.connection_string, {useUnifiedTopology: true});

        try {
            await this.client.connect();
        } catch {
            return false;
        }

        this.db = this.client.db(this.database);
        
        return true;
    }

    async initializeLink(discord_id: string): Promise<string> {
        const coll = this.db.collection('requests');

        let data: DBRequest[] = (await coll.find().toArray());
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
        await coll.insertOne(<DBRequest>{
            discord_id,
            token
        });
    
        return token;
    }

    async getLink(token: string): Promise<DBRequest | null> {
        const coll = this.db.collection('requests');

        let data: DBRequest[] = (await coll.find().toArray());
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
        const coll = this.db.collection('requests');
        await coll.deleteOne({token});
    }

    async insertToken(discord_id: string, access_token: string, refresh_token: string): Promise<void> {     
        const coll = this.db.collection('tokens');
        await coll.insertOne(<DBToken>{
            discord_id,
            access_token,
            refresh_token
        });
    }

    async updateAccessToken(discord_id: string, access_token: string): Promise<void> {
        const coll = this.db.collection('tokens');
        await coll.updateOne({discord_id}, {$set: {access_token}});
    }

    async getStoredTokens(): Promise<DBToken[]> {
        const coll = this.db.collection('tokens');
        return <DBToken[]>(await coll.find().toArray());
    }

    async getToken(discord_id: string): Promise<DBToken | null> {
        const coll = this.db.collection('tokens');
        return await coll.findOne({discord_id});
    }

    async deleteToken(discord_id: string): Promise<void> {
        const coll = this.db.collection('tokens');
        await coll.deleteOne({discord_id});
    }

    async getDeviceName(discord_id: string): Promise<string> {
        await this.makeSureUserinfo(discord_id);

        const coll = this.db.collection('userinfo');
        return (await coll.findOne({discord_id})).prefs.display_name;
    }

    async setDeviceName(discord_id: string, display_name: string): Promise<void> {
        await this.makeSureUserinfo(discord_id);

        const coll = this.db.collection('userinfo');
        await coll.updateOne({discord_id}, {$set: {
            'prefs.display_name': display_name
        }});
    }

    private async makeSureUserinfo(discord_id: string) {
        const coll = this.db.collection('userinfo');

        if (await coll.findOne({discord_id})) return;

        await coll.insertOne({
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