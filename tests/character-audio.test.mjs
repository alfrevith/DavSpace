import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameAudio, AUDIO_CUES, SOUNDTRACKS} from '../assets/js/character-audio.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({random = () => .3, fetchAudio} = {}) {
  const sources = [], tracks = [], requests = [];
  const node = () => ({connect() {}, disconnect() {}, gain: {value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}}});
  class Context {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; Context.instance = this; }
    createGain() { return node(); }
    createMediaElementSource() { return node(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({duration: 8}); }
    createBufferSource() {
      const source = {...node(), playbackRate: {setValueAtTime(value) { this.value = value; }}, start(...args) { this.args = args; }, stop() { this.stopped = true; }};
      sources.push(source); return source;
    }
  }
  const music = {src: '', listeners: {}, plays: 0, paused: true, addEventListener(n, fn) { this.listeners[n] = fn; },
    play() { tracks.push(this.src); this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; }, removeAttribute() { this.src = ''; }};
  const audio = createGameAudio({Context, makeAudio: () => music, baseURI: 'https://example.test/portfolio/', random,
    makeTrackURL: (_bytes, file) => `https://example.test/portfolio/assets/sprites/sound-effects/${file}`,
    fetchAudio: async (url, options) => { requests.push(url); return fetchAudio ? fetchAudio(url, options) : {ok: true, arrayBuffer: async () => new ArrayBuffer(1)}; }});
  return {audio, sources, music, tracks, requests, context: () => Context.instance};
}

test('all supplied audio paths exist with exact casing, including four soundtracks', () => {
  for (const file of [...Object.values(AUDIO_CUES).map(c => c.file), ...SOUNDTRACKS]) {
    assert(fs.readdirSync(new URL('../assets/sprites/sound-effects/', import.meta.url)).includes(file));
  }
  assert.equal(SOUNDTRACKS.length, 4);
});
test('preloading downloads all effects and music silently, reuses downloads and preserves shuffled playback', async () => {
  const s = setup(); assert.equal(s.requests.length, 0); assert.equal(s.music.plays, 0);
  await s.audio.preload(); await s.audio.preload();
  const count = new Set([...Object.values(AUDIO_CUES).map(c => c.file), ...SOUNDTRACKS]).size;
  assert.equal(s.requests.length, count); assert.equal(s.music.plays, 0); assert.equal(s.context(), undefined);
  s.audio.play('jump'); s.audio.beginKick(); s.audio.beginPunch(1);
  assert.equal(s.sources.length, 0); assert.equal(s.music.src, '');
  s.audio.unlock(); await s.audio.prepare();
  assert.equal(s.music.plays, 0, 'unlocking alone must not start playback');
  s.audio.setActive(true); await flush();
  for (let i = 0; i < 8; i++) { s.music.listeners.ended(); await flush(); }
  assert.equal(s.requests.length, count, 'all tracks and effects reuse their downloaded bytes');
  assert.equal(new Set(s.tracks.slice(0,4)).size, 4);
  for (let i = 1; i < s.tracks.length; i++) assert.notEqual(s.tracks[i], s.tracks[i-1]);
  assert(s.tracks.every(url => url.startsWith('https://example.test/portfolio/assets/sprites/sound-effects/')));
});
test('pause freezes effects and music, resume retains position, reset cancels old voices', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true); s.audio.play('jump');
  await flush();
  const track = s.music.src; s.music.currentTime = 14;
  s.audio.setActive(false); assert(s.music.paused); assert.equal(s.context().state, 'suspended');
  s.audio.play('punch'); assert.equal(s.sources.length, 1);
  s.audio.setActive(true); assert.equal(s.music.src, track); assert.equal(s.music.currentTime, 14);
  s.audio.reset(); assert(s.sources[0].stopped); assert(s.music.paused);
});

test('background downloads are bounded and failed files cannot stop preloading or start playback', async () => {
  let concurrent=0, peak=0;
  const s=setup({fetchAudio: async (url, options) => {
    concurrent++; peak=Math.max(peak,concurrent); await flush(); concurrent--;
    assert.equal(options.priority,'low');
    assert.equal(options.cache,'no-cache','replaced files must be revalidated rather than forced from stale cache');
    if(url.endsWith('jump.mp3'))throw Error('offline');
    return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};
  }});
  await s.audio.preload();
  assert.equal(peak,2); assert.equal(concurrent,0);
  assert.equal(s.requests.length,new Set([...Object.values(AUDIO_CUES).map(c=>c.file),...SOUNDTRACKS]).size);assert.equal(s.context(),undefined);
  assert.equal(s.music.plays,0);assert.equal(s.sources.length,0);
});

test('a soundtrack finishing its download after pause or reset cannot autoplay', async () => {
  let release;
  const s=setup({fetchAudio:async url=>{
    if(url.includes('soundtrack'))await new Promise(resolve=>{release=resolve;});
    return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};
  }});
  s.audio.unlock(); await s.audio.prepare();s.audio.setActive(true);await flush();
  s.audio.setActive(false);release();await flush();
  assert.equal(s.music.plays,0);assert(s.music.paused);
  s.audio.setActive(true);await flush();assert.equal(s.music.plays,1);
  s.music.listeners.ended();await flush();s.audio.reset();s.audio.setActive(false);
  release();await flush();assert.equal(s.music.plays,1);assert.equal(s.music.src,'');
});

test('each achievement plays only its chime immediately and does not repeat after resume', async()=>{
  const s=setup();s.audio.unlock();await s.audio.prepare();s.audio.setActive(true);
  s.context().currentTime=12;s.audio.achievement();
  assert.equal(s.sources.length,1);
  assert.equal(s.sources[0].args[1],AUDIO_CUES.achievement.offset);
  assert.equal(s.sources[0].args[1],0,'use the beginning of the replacement audio');
  assert.equal(s.sources[0].args[2],8,'use the complete decoded buffer rather than the old fixed trim');
  assert.equal(s.sources[0].args[0],12);
  s.audio.setActive(false);assert.equal(s.context().state,'suspended');
  s.audio.setActive(true);assert.equal(s.sources.length,1,'resume never repeats the achievement');
  s.audio.reset();assert(s.sources.every(v=>v.stopped));
  s.audio.achievement();s.audio.setMuted(true);assert(s.sources.every(v=>v.stopped));
});

test('a reward during asynchronous audio resume is played once, while reset invalidates its pending sound',async()=>{
  const s=setup();s.audio.unlock();await s.audio.prepare();s.audio.setActive(true);
  let finish;
  s.context().state='suspended';s.context().resume=()=>new Promise(resolve=>{finish=()=>{s.context().state='running';resolve();};});
  s.audio.achievement();assert.equal(s.sources.length,0);finish();await flush();assert.equal(s.sources.length,1);
  s.context().state='suspended';s.audio.achievement();s.audio.reset();finish();await flush();
  assert.equal(s.sources.length,1);assert(s.sources.every(v=>v.stopped));
});

test('barrages do not evict the achievement chime, and muted or unavailable rewards stay silent',async()=>{
  const s=setup();s.audio.unlock();await s.audio.prepare();s.audio.setActive(true);s.audio.achievement();
  for(let i=0;i<20;i++){s.context().currentTime+=.06;s.audio.play('gunshot');}
  assert(!s.sources[0].stopped);
  assert(s.sources.filter(v=>!v.stopped).length<=12);
  const missing=setup({fetchAudio:async url=>({ok:!url.endsWith('achievement.mp3'),arrayBuffer:async()=>new ArrayBuffer(1)})});
  missing.audio.unlock();await missing.audio.prepare();missing.audio.setActive(true);missing.audio.achievement();
  assert.equal(missing.sources.length,0);
  s.audio.reset();s.audio.setActive(false);s.audio.achievement();assert(s.sources.every(v=>v.stopped));
});
test('dive loops only the falling part and impact immediately starts the final transient even on short falls', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
  s.audio.beginKick(); const fall = s.sources[0];
  assert(fall.loop); assert(fall.loopEnd < AUDIO_CUES.kick.impact);
  s.audio.impactKick(); assert(fall.stopped); assert.equal(s.sources[1].args[1], .775);
  assert(!s.sources[1].loop);
});

test('haki uses the complete decoded sound duration and its clock respects pause, mute and reset',async()=>{
  const s=setup();assert.equal(s.audio.beginHaki(),false);
  s.audio.unlock();await s.audio.prepare();s.audio.setActive(true);s.context().currentTime=10;
  assert(s.audio.beginHaki());assert.equal(s.audio.duration('haki'),8);
  assert.equal(s.sources[0].args[1],0);assert.equal(s.sources[0].args[2],8);
  s.context().currentTime=10.25;assert.equal(s.audio.hakiTime(),.25);
  s.audio.setActive(false);assert.equal(s.context().state,'suspended');assert.equal(s.audio.hakiTime(),.25);
  s.audio.setActive(true);s.audio.setMuted(true);assert(s.sources[0].stopped);
  s.context().currentTime=19;assert.equal(s.audio.hakiTime(),8,'muting never extends visual duration');
  s.audio.reset();assert.equal(s.audio.hakiTime(),null);
});
test('muting silences new effects and crowded impacts have bounded voices; missing audio stays nonfatal', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
  for (let i = 0; i < 30; i++) { s.context().currentTime += .1; s.audio.play('punch'); }
  assert(s.sources.filter(v => !v.stopped).length <= 12);
  s.audio.setMuted(true); const count = s.sources.length; s.audio.play('cannon'); assert.equal(s.sources.length, count);
  s.audio.setMuted(false); s.context().currentTime += 1; s.audio.play('cannon'); assert.equal(s.sources.length, count+1);
  const unavailable = createGameAudio({Context: null}); await unavailable.prepare(); unavailable.unlock(); unavailable.setActive(true); unavailable.play('jump');
});
test('every sword audio event belongs to the actual ground strike, not windup or the upward vortex', async () => {
  const {createSurvival, stepSurvival} = await import('../assets/js/character-survival.js');
  const {createCharacter} = await import('../assets/js/character-physics.js');
  for (const attackKind of ['slash','upper']) {
    const game = createSurvival(); game.phase = 'playing'; const actor = createCharacter();
    game.enemies.push({id: 1,type:'sword',x:actor.x+70,y:368,health:42,maxHealth:42,mode:'aim',modeTime:.77,
      aimDuration:.78,attackKind,facing:-1,entered:true,speed:60,vx:0,attackCount:0});
    stepSurvival(game,actor,{},1/120);
    assert.equal(game.events.some(e=>e.type==='sword-attack'),false);
    stepSurvival(game,actor,{},1/120);
    assert.equal(game.events.some(e=>e.type==='sword-attack'),attackKind==='slash');
    assert.equal(game.events.some(e=>e.type==='spinning-sword'),attackKind==='upper');
    stepSurvival(game,actor,{},1/120);
    assert.equal(game.events.some(e=>e.type==='sword-attack'),false);
  }
});

test('charged punches split speech, release and hit; missing punches never play an impact', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
  s.audio.beginPunch(1); s.audio.beginPunch(1);
  assert.equal(s.sources.length, 1, 'holding does not repeat the spoken phrase');
  assert.equal(s.sources[0].args[1], AUDIO_CUES.charged.offset);
  s.audio.releasePunch(1); s.audio.releasePunch(1);
  assert(s.sources[0].stopped);
  assert.equal(s.sources[1].args[1], AUDIO_CUES.charged.release);
  assert(s.sources[1].args[1] + s.sources[1].args[2] < AUDIO_CUES.charged.impact);
  s.audio.returnArm(1,.12); s.audio.returnArm(1,.12);
  assert.equal(s.sources.length, 3);
  assert.equal(s.sources[2].args[1], AUDIO_CUES.armReturn.offset);
  assert(Math.abs(s.sources[2].args[2] / s.sources[2].playbackRate.value - .12) < 1e-9);
  assert(!s.sources.some(v => v.args[1] === AUDIO_CUES.charged.impact));
  s.audio.beginPunch(2); s.audio.releasePunch(2);
  assert(s.audio.impactPunch(2)); assert(s.audio.impactPunch(2));
  assert.equal(s.sources.filter(v => v.args[1] === AUDIO_CUES.charged.impact).length, 1, 'one impact for a multi-target punch');
  assert(!s.audio.impactPunch(1), 'stale hits cannot trigger another attack sound');
});

test('canceling a charge cannot resume the phrase or play a release/impact after pausing', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
  s.audio.beginPunch(1); s.audio.cancelCharge(); s.audio.setActive(false); s.audio.setActive(true);
  s.audio.releasePunch(1); s.audio.returnArm(1,.12);
  assert(!s.audio.impactPunch(1)); assert.equal(s.sources.length, 1); assert(s.sources[0].stopped);
});

test('short missed punches choose only the first three whooshes and never repeat a serial', async () => {
  const chosen = new Set();
  for (const random of [0, .49, .999]) {
    const s = setup({random: () => random});
    s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
    s.audio.shortPunchMiss(1); s.audio.shortPunchMiss(1);
    assert.equal(s.sources.length, 1);
    const [, offset, duration] = s.sources[0].args;
    chosen.add(offset);
    assert(AUDIO_CUES.whoosh.variants.some(v => v.offset === offset && v.duration === duration));
    assert(offset + duration < 2.8, 'the fourth whoosh and later recordings are excluded');
    s.audio.setActive(false); s.audio.setActive(true); s.audio.shortPunchMiss(1);
    assert.equal(s.sources.length, 1, 'resuming a recovery cannot replay a miss');
    s.audio.reset(); s.audio.shortPunchMiss(1);
    assert.equal(s.sources.length, 2, 'a fresh run may reuse attack serials');
  }
  assert.equal(chosen.size, 3);
});

test('charged missed punches retain their own release sound without a short whoosh', async () => {
  const s = setup(); s.audio.unlock(); await s.audio.prepare(); s.audio.setActive(true);
  s.audio.beginPunch(4); s.audio.releasePunch(4); s.audio.returnArm(4, .2); s.audio.shortPunchMiss(4);
  assert.equal(s.sources.length, 3);
  assert(!s.sources.some(v => AUDIO_CUES.whoosh.variants.some(cue => cue.offset === v.args[1])));
});
