import axios from "axios";
import { DBToken } from "../../db";

interface SubState
{
    playback_speed: number;
    position: number;
    duration: number;
    stream_time: number;
}

interface SpotifyState
{
    prev_state_ref: any;
    registration_token: string;
    seek_to?: number;
    selected_alias_id: any;
    state_machine: StateMachine;
    state_ref: StateRef;
    type: string;
}

interface StateRef
{
    active_alias: any;
    paused: boolean;
    state_index: number;
}

interface StateMachine
{
    attributes: StateMachineAttributes;
    state_machine_id: string;
    states: State[];
    tracks: Track[];
}

interface StateMachineAttributes
{
    options: StateMachineAttributesOptions;
    playback_session_id: string;
}

interface StateMachineAttributesOptions
{
    repeating_context: boolean;
    repeating_track: boolean;
    shuffling_context: boolean;
}

interface State
{
    disallow_seeking: boolean;
    duration_override: any;
    initial_playback_position: any;
    player_cookie: string;
    position_offset: any;
    restrictions: any;
    segment_start_position: any;
    segment_stop_position: any;
    state_id: string;
    track: number;
    track_uid: string;
    transitions: StateTransitions;
}

interface StateRestrictions
{
    disallow_resuming_reasons: string[];
    disallow_resuming_prev_reasons: string[];
}

interface StateTransitions
{
    advance: StateRef;
    show_next: StateRef;
    show_prev: StateRef;
    skip_next: StateRef;
    skip_prev: StateRef;
}

export interface Track
{
    content_type: string;
    manifest: TrackManifest;
    metadata: TrackMetadata;
    ms_played_until_update: number;
    ms_playing_update_interval: number;
    track_type: string;
}

interface TrackManifest
{
    file_ids_mp4: TrackFile[];
    file_ids_mp4_dual: TrackFile[];
}

interface TrackFile
{
    audio_quality: string;
    bitrate: number;
    file_id: string;
    file_url: string;
    format: string;
    impression_urls: any;
    track_type: string;
}

interface TrackMetadata
{
    authors: TrackAuthor[];
    context_description: any;
    context_uri: string;
    duration: number;
    group_name: string;
    group_uri: string;
    images: TrackImage[];
    linked_from_uri: any;
    name: string;
    uri: string;
}

interface TrackAuthor
{
    name: string;
    uri: string;
}

interface TrackImage
{
    url: string;
    height: number;
    width: number;
}

interface SocketStateRef {
    state_machine_id: string;
    state_id: string;
    paused: boolean;
    active_alias: any;
}

export class SpotifyStateManager {
    private current_state: SpotifyState;
    private previous_state: SpotifyState;

    private last_payload: any;

    constructor(protected device_id: string, protected seq: number, protected token: DBToken, protected client_id: string, protected client_secret: string) {}

    public replaceState(state: SpotifyState) {
        this.previous_state = this.current_state;
        this.current_state = state;
    }

    public isActiveDevice(): boolean {
        return !!(this.current_state && this.current_state.state_ref);
    }

    public wasActiveDevice(): boolean {
        return !!(this.previous_state && this.previous_state.state_ref);
    }

    public isStateId(): string | undefined {
        return this.current_state?.state_machine?.states[this.current_state?.state_ref?.state_index]?.state_id;
    }

    public wasStateId(): string {
        return this.previous_state?.state_machine?.states[this.previous_state?.state_ref?.state_index]?.state_id;
    }

    public isSameStateAsBefore(): boolean {
        return this.isStateId() && this.wasStateId() && this.isStateId() === this.wasStateId();
    }

    public isPaused(): boolean {
        return this.current_state.state_ref.paused;
    }

    public wasPaused(): boolean {
        return this.previous_state.state_ref.paused;
    }

    public isSeeking(): boolean {
        return this.current_state.seek_to != null;
    }

    public getSeek(): number {
        return this.current_state.seek_to;
    }

    public getCurrentTrack(): Track {
        return this.current_state.state_machine.tracks[this.current_state.state_machine.states[this.current_state.state_ref.state_index].track];
    }

    public isCurrentStateRef(ref: SocketStateRef): boolean {
        const c_ref = this.getCurrentStateRef() || null;

        if (c_ref == null && ref == null) return true;

        return c_ref.state_machine_id === ref.state_machine_id &&
            c_ref.state_id === ref.state_id &&
            c_ref.paused === ref.paused
    }

    public async rejectState(ref: SocketStateRef, track_pos: number, callback: Function) {
        let payload = {
            seq_num: void 0,
            seq_nums: void 0,
            state_ref: ref,
            sub_state: {
                playback_speed: ref && !ref.paused ? 1 : 0,
                position: track_pos,
                duration: this.getCurrentTrack().metadata.duration || void 0
            },
            previous_position: track_pos,
            rejected_state_refs: void 0
        }

        payload.rejected_state_refs = [ref];
        payload.seq_nums = [++this.seq];

        let results = await axios.post(`https://api.spotify.com/v1/track-playback/v1/devices/${this.device_id}/state_conflict`, payload, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (results.status >= 400) {
            if (!await this.refreshAccessToken()) {
                return false;
            }

            results = await axios.post(`https://api.spotify.com/v1/track-playback/v1/devices/${this.device_id}/state_conflict`, payload, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (results.status >= 400) {
                console.debug(`CONFLICT FAIL {${results.status}}`);
                return false;
            }
        }

        callback({
            data: JSON.stringify({
                uri: 'hm://track-playback/v1/command',
                payloads: results.data.commands
            })
        });
    }

    public getCurrentStateRef(): SocketStateRef {
        const state_machine = this.current_state?.state_machine;
        let paused;
        let state: State;

        if (!state_machine || this.current_state.state_ref.state_index === null) return null;

        if (this.current_state.state_ref.state_index < 0) {
            const new_state = this.current_state && state_machine.states[this.current_state.state_ref.state_index].transitions.advance;
            new_state && (state = state_machine.states[new_state.state_index], paused = new_state.paused);
        } else {
            state = state_machine.states[this.current_state.state_ref.state_index];
            paused = this.isPaused();
        }

        return state ? {
            state_machine_id: state_machine.state_machine_id,
            state_id: state.state_id,
            paused: !!paused,
            active_alias: null
        } : null;
    }

    public advanceTrack(): boolean {
        if (!this.isActiveDevice()) return false;

        const stateIdx = this.current_state.state_ref.state_index;
        const state = this.current_state.state_machine.states[stateIdx];
        if (!state.transitions.advance) return false;

        this.current_state.state_ref = state.transitions.advance;
        return true;
    }

    public async playTrackUri(track_uri: string, position: number): Promise<boolean> {
        let response = await axios.put('https://api.spotify.com/v1/me/player/play', {
            uris: [track_uri],
            position_ms: position
        }, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) {
            if (response.status === 404) return false;

            if (!await this.refreshAccessToken()) {
                console.debug('refreshAccessToken[/play] failed');
                return false;
            }

            response = await axios.put('https://api.spotify.com/v1/me/player/play', {
                uris: [track_uri],
                position_ms: position
            }, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (response.status >= 400) {
                console.debug('/play failed');
                return false;
            }
        }

        return true;
    }

    public async seekTo(position: number): Promise<boolean> {
        let response = await axios.put(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}`, {}, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) {
            if (response.status === 404) return false;

            if (!await this.refreshAccessToken()) {
                console.debug('refreshAccessToken[/seek] failed');
                return false;
            }

            response = await axios.put(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}`, {}, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (response.status >= 400) {
                console.debug('/seek failed');
                return false;
            }
        }

        return true;
    }

    public async pausePlayback(): Promise<boolean> {
        let response = await axios.put('https://api.spotify.com/v1/me/player/pause', {}, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) {
            if (response.status === 404) return false;

            if (!await this.refreshAccessToken()) {
                console.debug('refreshAccessToken[/pause] failed');
                return false;
            }

            response = await axios.put('https://api.spotify.com/v1/me/player/pause', {}, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (response.status >= 400) {
                console.debug('/pause failed');
                return false;
            }
        }

        return true;
    }

    public async resumePlayback(): Promise<boolean> {
        let response = await axios.put('https://api.spotify.com/v1/me/player/play', {}, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) {
            if (response.status === 404) return false;

            if (!await this.refreshAccessToken()) {
                console.debug('refreshAccessToken[/play[resume]] failed');
                return false;
            }

            response = await axios.put('https://api.spotify.com/v1/me/player/play', {}, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (response.status >= 400) {
                console.debug('/play[resume] failed');
                return false;
            }
        }

        return true;
    }

    public async playAlbumUri(album_uri: string, offset: number, position: number): Promise<boolean> {
        let response = await axios.put('https://api.spotify.com/v1/me/player/play', {
            context_uri: album_uri,
            offset: {
                position: offset
            },
            position_ms: position
        }, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (response.status >= 400) {
            if (response.status === 404) return false;

            if (!await this.refreshAccessToken()) {
                console.debug('refreshAccessToken[/play[album]] failed');
                return false;
            }

            response = await axios.put('https://api.spotify.com/v1/me/player/play', {
                context_uri: album_uri,
                offset: {
                    position: offset
                },
                position_ms: position
            }, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (response.status >= 400) {
                console.debug('/play[album] failed');
                return false;
            }
        }

        return true;
    }

    public async emitPaused(position: number, paused: boolean): Promise<boolean> {
        const payload = {
            seq_num: ++this.seq,
            previous_position: position,
            state_ref: {
                paused,
                state_id: this.isStateId(),
                state_machine_id: this.current_state.state_machine.state_machine_id
            },
            sub_state: {
                stream_time: 0,
                position,
                playback_speed: paused ? 0 : 1,
                duration: this.current_state.state_machine.tracks[this.current_state.state_machine.states[this.current_state.state_ref.state_index].track].metadata.duration
            },
            debug_source: 'modify_current_state'
        }

        return await this.emit(payload);
    }

    public async emitSeek(position: number, prevPosition: number): Promise<boolean> {
        const payload = {
            seq_num: ++this.seq,
            previous_position: prevPosition,
            state_ref: {
                paused: this.isPaused(),
                state_id: this.isStateId(),
                state_machine_id: this.current_state.state_machine.state_machine_id
            },
            sub_state: {
                stream_time: 0,
                position,
                playback_speed: this.isPaused() ? 0 : 1,
                duration: this.current_state.state_machine.tracks[this.current_state.state_machine.states[this.current_state.state_ref.state_index].track].metadata.duration
            },
            debug_source: 'position_changed'
        }

        return await this.emit(payload);
    }

    public async emitModify(position: number): Promise<boolean> {
        const payload = {
            seq_num: ++this.seq,
            previous_position: position,
            state_ref: {
                paused: this.isPaused(),
                state_id: this.isStateId(),
                state_machine_id: this.current_state.state_machine.state_machine_id
            },
            sub_state: {
                stream_time: 0,
                position,
                playback_speed: this.isPaused() ? 0 : 1,
                duration: this.current_state.state_machine.tracks[this.current_state.state_machine.states[this.current_state.state_ref.state_index].track].metadata.duration
            },
            debug_source: 'modify_current_state'
        }

        return await this.emit(payload);
    }

    // BTL => Before Track Load
    public async emitBTL(): Promise<boolean> {
        const payload = {
            seq_num: ++this.seq,
            state_ref: {
                paused: this.isPaused(),
                state_id: this.isStateId(),
                state_machine_id: this.current_state.state_machine.state_machine_id
            },
            sub_state: {
                stream_time: 0,
                position: 0,
                playback_speed: this.isPaused() ? 0 : 1,
                duration: this.current_state.state_machine.tracks[this.current_state.state_machine.states[this.current_state.state_ref.state_index].track].metadata.duration
            },
            debug_source: 'before_track_load'
        }

        return await this.emit(payload);
    }

    public async emitClearState() {
        const payload = {
            seq_num: ++this.seq,
            state_ref: null,
            sub_state: {
                stream_time: 0,
                position: 0,
                playback_speed: 0,
                duration: 0
            },
            debug_source: 'state_clear'
        }

        return await this.emit(payload);
    }

    private async emit(payload: object): Promise<boolean> {
        let results = await axios.put(`https://api.spotify.com/v1/track-playback/v1/devices/${this.device_id}/state`, payload, {
            headers: {
                Authorization: `Bearer ${this.token.access_token}`
            },
            validateStatus: () => true
        });

        if (results.status >= 400) {
            if (!await this.refreshAccessToken()) {
                return false;
            }

            results = await axios.put(`https://api.spotify.com/v1/track-playback/v1/devices/${this.device_id}/state`, payload, {
                headers: {
                    Authorization: `Bearer ${this.token.access_token}`
                },
                validateStatus: () => true
            });

            if (results.status >= 400) {
                return false;
            }
        }

        this.parseUpdatedState(results.data);

        return true;
    }

    private parseUpdatedState(data: any) {
        this.current_state.state_machine = data.state_machine;
        this.current_state.state_ref = data.updated_state_ref;
    }

    private async refreshAccessToken(): Promise<boolean> {
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', this.token.refresh_token);

        const resp = await axios.post('https://accounts.spotify.com/api/token', params.toString(), {
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: () => true
        });

        if (resp.status >= 400) return false;

        const data = resp.data;
        this.token.access_token = data.access_token;

        return true;
    }
}