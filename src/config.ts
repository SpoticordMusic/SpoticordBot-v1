import fs from 'fs';
import assert from 'assert';

export default class ConfigManager {
    private dirty: Error = null;
    private config: Map<string, any>

    constructor() {
        try {
            const buf = fs.readFileSync('./config.json', {encoding: 'utf8'});
            this.config = new Map(Object.entries(JSON.parse(buf)));

            assert(this.config.has('token'), 'Missing field: token');

            assert(this.config.has('spotify_client_id'), 'Missing field: spotify_client_id');
            assert(this.config.has('spotify_client_secret'), 'Missing field: spotify_client_secret');

            if (this.config.has('database')) {
                const db = this.config.get('database');
                assert(typeof db === 'object', 'Dirty field: database');
                assert(!(db.strategy === 'json' && !db.filename), 'Dirty field: database.filename (required when strategy == "json")');
                assert(!(db.strategy === 'mongo' && !db.username), 'Dirty field: database.username (required when strategy == "mongo")');
                assert(!(db.strategy === 'mongo' && !db.password), 'Dirty field: database.password (required when strategy == "mongo")');
                assert(!(db.strategy === 'mongo' && !db.host), 'Dirty field: database.host (required when strategy == "mongo")');
                assert(!(db.strategy === 'mongo' && !db.port), 'Dirty field: database.port (required when strategy == "mongo")');
                assert(!(db.strategy === 'mongo' && !db.db), 'Dirty field: database.db (required when strategy == "mongo")');
            } else {
                this.config.set('database', {
                    strategy: 'json',
                    filename: 'db'
                });
            }

            // assert(this.config.has('nodes'), 'Missing field: nodes');

            // const nodes = this.config.get('nodes');

            // assert(Array.isArray(nodes), 'Dirty field: nodes');
            // assert(nodes.length, 'Dirty field: nodes');

            if (this.config.has('realtime')) {
                const realtime = this.config.get('realtime');
                assert(typeof realtime === 'object', 'Dirty field: realtime');
                assert(typeof realtime.port === 'number', 'Dirty field: realtime.port');
                assert(typeof realtime.host === 'string', 'Dirty field: realtime.host')
            }
        } catch (ex) {
            this.dirty = ex;
            return;
        }
    }

    public get(key: string): any {
        return this.config.get(key);
    }

    public getDirty(): Error {
        return this.dirty;
    }
}