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
            assert(this.config.has('prefix'), 'Missing field: prefix');

            assert(this.config.has('spotify_client_id'), 'Missing field: spotify_client_id');
            assert(this.config.has('spotify_client_secret'), 'Missing field: spotify_client_secret');

            assert(this.config.has('nodes'), 'Missing field: nodes');

            const nodes = this.config.get('nodes');

            assert(Array.isArray(nodes), 'Dirty field: nodes');
            assert(nodes.length, 'Dirty field: nodes');
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