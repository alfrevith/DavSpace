// Cue offsets refer to the supplied MP3s. Trim silence and the sword compilation
// at playback time; never rewrite source audio or stretch a whole recording.
import { HAKI_TUNING } from './character-haki.js';
const ROOT = 'assets/sprites/sound-effects/';
export const AUDIO_CUES = Object.freeze({
  jump: {file: 'jump.mp3', offset: .145, duration: .5, volume: .42},
  haki: {file: 'Conqueror-Haki.mp3', offset: 0, duration: HAKI_TUNING.duration, volume: .72},
  achievement: {file: 'achievement.mp3', offset: 0, volume: .42},
  cannon: {file: 'cannonball-impact.mp3', offset: 1.15, duration: 2.2, volume: .65},
  gear: {file: 'gear-second.mp3', offset: .5, duration: 2.05, volume: .65},
  punch: {file: 'punch-impact.mp3', offset: .25, duration: .55, volume: .3},
  whoosh: {file: 'Whoosh-Sounds.mp3', offset: .22, duration: .22, volume: .55, variants: Object.freeze([
    {offset: .22, duration: .22, volume: .55},
    {offset: 1, duration: .23, volume: .8},
    {offset: 1.92, duration: .33, volume: .35}
  ])},
  sword: {file: 'sword-attack.mp3', offset: 1.325, duration: .45, volume: .58},
  gunshot: {file: 'gunshot.mp3', offset: 1.175, duration: 2.05, volume: .4},
  spinning: {file: 'spinning-sword-attack.mp3', offset: .575, duration: .6, volume: 2},
  charged: {file: 'punch-charged.mp3', offset: .275, duration: 1.45, release: 2.075, impact: 4.25, volume: 1.7},
  armReturn: {file: 'arm-return.mp3', offset: 2.9, duration: .4, volume: .45},
  health: {file: 'health-sound.mp3', offset: .2, duration: 1.4, volume: .9},
  kick: {file: 'stamp-falling-impact.mp3', offset: .55, impact: .775, duration: .45, volume: .75}
});
export const SOUNDTRACKS = Object.freeze(['soundtrack.mp3', 'soundtrack-2.mp3', 'soundtrack-3.mp3', 'soundtrack-4.mp3']);

export function createGameAudio({baseURI = globalThis.document?.baseURI, Context = globalThis.AudioContext || globalThis.webkitAudioContext,
  makeAudio = () => new Audio(), fetchAudio = (url, options) => fetch(url, options), random = Math.random,
  makeTrackURL = bytes => URL.createObjectURL(new Blob([bytes], {type: 'audio/mpeg'}))} = {}) {
  let context, master, musicGain, music, loading, active = false, muted = false;
  let preloading, musicPending = false, musicRequest = 0;
  let audioEpoch = 0;
  let hakiClock = null;
  let bag = [], current = '', kickVoice = null, punch = null, lastShortMiss = -1;
  const buffers = new Map(), voices = new Set(), recent = new Map(), failed = new Set();
  const downloads = new Map(), trackURLs = new Map();
  const url = file => new URL(ROOT + file, baseURI).href;

  function download(file) {
    if (!downloads.has(file)) {
      const request = Promise.resolve().then(async () => {
        // Revalidate on each visit so replacing an MP3 at the same path is
        // reflected immediately. The per-visit map still deduplicates requests.
        const response = await fetchAudio(url(file), {cache: 'no-cache', priority: 'low'});
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).catch(error => { downloads.delete(file); throw error; });
      downloads.set(file, request);
    }
    return downloads.get(file);
  }
  function preload() {
    if (preloading) return preloading;
    // Two background downloads at a time leave room for page images. Music
    // stays compressed; no media element or audio context is started here.
    const queue = [...new Set([...Object.values(AUDIO_CUES).map(cue => cue.file), ...SOUNDTRACKS])];
    const worker = async () => {
      while (queue.length) {
        try { await download(queue.shift()); } catch { /* A failed preload never blocks the page or the game. */ }
      }
    };
    preloading = Promise.all([worker(), worker()]);
    return preloading;
  }

  function ensureContext() {
    if (context || !Context) return context;
    try {
      context = new Context();
      master = context.createGain(); master.gain.value = muted ? 0 : 1;
      // Dense late-game barrages must not clip when several effects overlap.
      if (context.createDynamicsCompressor) {
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -6; limiter.knee.value = 3; limiter.ratio.value = 12;
        limiter.attack.value = .003; limiter.release.value = .12;
        master.connect(limiter); limiter.connect(context.destination);
      } else master.connect(context.destination);
      musicGain = context.createGain(); musicGain.gain.value = .18; musicGain.connect(master);
    } catch { context = null; }
    return context;
  }
  function prepare() {
    if (loading) return loading;
    if (!ensureContext()) return Promise.resolve();
    loading = Promise.allSettled([...new Set(Object.values(AUDIO_CUES).map(cue => cue.file))].map(async file => {
      const bytes = await download(file);
      const buffer = await context.decodeAudioData(bytes.slice(0));
      buffers.set(file, buffer);
    }));
    return loading;
  }
  function safePlayMusic() {
    if (!active || !music || musicPending) return;
    try { music.play()?.catch(() => {}); } catch { /* Audio never blocks gameplay. */ }
  }
  function nextTrack() {
    if (!active || failed.size >= SOUNDTRACKS.length) return;
    if (!bag.length) {
      bag = SOUNDTRACKS.filter(file => !failed.has(file));
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at(-1) === current && bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
    }
    current = bag.pop();
    if (!current) return;
    const file = current, request = ++musicRequest;
    musicPending = true;
    download(file).then(bytes => {
      if (!trackURLs.has(file)) trackURLs.set(file, makeTrackURL(bytes, file));
      return trackURLs.get(file);
    }).catch(() => url(file)).then(source => {
      // Loading can finish after Pause/Restart. Only the current selection may
      // update the element, and safePlayMusic still requires an active game.
      if (request !== musicRequest) return;
      musicPending = false;
      music.src = source;
      safePlayMusic();
    });
  }
  // Called directly by Play/Restart, before awaiting images: mobile browsers
  // require a real user gesture to resume their audio context.
  function unlock() {
    if (!ensureContext()) return;
    context.resume()?.catch(() => {});
    prepare();
    if (!music) {
      try {
        music = makeAudio(); music.preload = 'none';
        context.createMediaElementSource(music).connect(musicGain);
        music.addEventListener('ended', nextTrack);
        music.addEventListener('error', () => {
          failed.add(current); bag = bag.filter(file => !failed.has(file)); nextTrack();
        });
      } catch { music = null; }
    }
  }
  function stop(voice) {
    if (!voice) return;
    try { voice.source.stop(); } catch { /* Already finished. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voices.delete(voice);
    if (kickVoice === voice) kickVoice = null;
  }
  function play(name, {offset, duration, loop = false, force = false, rate = 1} = {}) {
    if (!active || muted || !context || context.state !== 'running') return null;
    const cue = AUDIO_CUES[name], buffer = buffers.get(cue?.file);
    if (!buffer) return null; // Never replay a late download after its event.
    const now = context.currentTime;
    if (!loop && !force && now - (recent.get(name) ?? -100) < .055) return null;
    recent.set(name, now);
    if (voices.size >= 12) stop([...voices].find(voice => voice !== kickVoice && !voice.priority) || [...voices].find(voice => voice !== kickVoice) || kickVoice);
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.connect(gain); gain.connect(master);
    const variant = cue.variants?.[Math.min(cue.variants.length - 1, Math.max(0, Math.floor((Number(random()) || 0) * cue.variants.length)))] || cue;
    const start = offset ?? variant.offset, length = Math.min(duration ?? variant.duration ?? buffer.duration - start, buffer.duration - start);
    const volume = variant.volume ?? cue.volume;
    if (length <= 0) { source.disconnect(); gain.disconnect(); return null; }
    rate = Math.max(.25, Math.min(4, rate));
    source.playbackRate.setValueAtTime(rate, now);
    const seconds = length / rate;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .004);
    const voice = {source, gain, priority: name === 'achievement' || name === 'haki'}; voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); voices.delete(voice); if (kickVoice === voice) kickVoice = null; };
    if (loop) { source.loop = true; source.loopStart = start; source.loopEnd = start + length; source.start(now, start); }
    else {
      gain.gain.setValueAtTime(volume, now + Math.max(.005, seconds - .025));
      gain.gain.linearRampToValueAtTime(0, now + seconds);
      source.start(now, start, length);
    }
    return voice;
  }
  function achievement() {
    if (!active || muted || !context || !buffers.has(AUDIO_CUES.achievement.file)) return;
    const announce = () => play('achievement', {force: true});
    if (context.state === 'running') { announce(); return; }
    // Resume is asynchronous on phones. A reward earned in its first frame
    // must not disappear, nor leak into a paused, muted or restarted run.
    const epoch = audioEpoch;
    try { context.resume()?.then(() => { if (epoch === audioEpoch && active && !muted) announce(); }).catch(() => {}); } catch { /* Audio stays nonfatal. */ }
  }
  const duration = name => buffers.get(AUDIO_CUES[name]?.file)?.duration || AUDIO_CUES[name]?.duration || 0;
  function beginHaki() {
    cancelHaki();
    if (!active || !context || context.state === 'closed') return false;
    const clock = hakiClock = {start: context.currentTime, duration: duration('haki'), voice: null, ready: false};
    const epoch = audioEpoch;
    const begin = () => {
      if (clock !== hakiClock || epoch !== audioEpoch || !active) return;
      clock.start = context.currentTime;
      clock.ready = true;
      clock.voice = play('haki', {duration: clock.duration, force: true});
    };
    if (context.state === 'running') begin();
    else { try { context.resume()?.then(begin).catch(() => { if (clock === hakiClock) hakiClock = null; }); } catch { hakiClock = null; } }
    return true;
  }
  function cancelHaki() { stop(hakiClock?.voice); hakiClock = null; }
  function hakiTime() { return hakiClock?.ready && context ? Math.min(hakiClock.duration, Math.max(0, context.currentTime - hakiClock.start)) : null; }
  function beginKick() {
    stop(kickVoice);
    const cue = AUDIO_CUES.kick;
    kickVoice = play('kick', {duration: cue.impact - cue.offset - .015, loop: true});
  }
  function impactKick() {
    stop(kickVoice);
    play('kick', {offset: AUDIO_CUES.kick.impact, duration: .45, force: true});
  }
  function cancelPunch() {
    if (punch) for (const voice of punch.voices) stop(voice);
    punch = null;
  }
  function beginPunch(serial) {
    if (punch?.serial === serial) return;
    cancelPunch();
    punch = {serial, phase: 'charge', hit: false, returned: false, voices: [play('charged', {force: true})]};
  }
  function cancelCharge() {
    if (punch?.phase === 'charge') cancelPunch();
  }
  function releasePunch(serial) {
    if (punch?.serial !== serial || punch.phase !== 'charge') return;
    stop(punch.voices[0]); punch.phase = 'release';
    // The impact tail is deliberately excluded, even if this punch misses.
    punch.voices.push(play('charged', {offset: AUDIO_CUES.charged.release,
      duration: AUDIO_CUES.charged.impact - AUDIO_CUES.charged.release - .1, force: true}));
  }
  function impactPunch(serial) {
    if (punch?.serial !== serial || punch.phase === 'charge') return false;
    if (!punch.hit) {
      punch.hit = true;
      punch.voices.push(play('charged', {offset: AUDIO_CUES.charged.impact, duration: .75, force: true}));
    }
    return true;
  }
  function returnArm(serial, seconds) {
    if (punch?.serial !== serial || punch.returned || punch.phase === 'charge') return;
    punch.returned = true;
    punch.voices.push(play('armReturn', {rate: .4 / Math.max(.1, seconds), force: true}));
  }
  function shortPunchMiss(serial) {
    // Only called after the whole strike window has missed. Charged punches
    // already have their own release audio; pausing cannot repeat this cue.
    if (lastShortMiss === serial || punch?.serial === serial) return;
    lastShortMiss = serial;
    play('whoosh');
  }
  function setActive(value, {finishEffects = false} = {}) {
    active = !!value;
    if (active) {
      context?.resume()?.catch(() => {});
      if (music && !musicPending) { if (music.src && !music.ended) safePlayMusic(); else nextTrack(); }
    } else {
      audioEpoch++;
      music?.pause();
      if (finishEffects) { stop(kickVoice); cancelCharge(); }
      else context?.suspend()?.catch(() => {});
    }
  }
  function reset() {
    cancelHaki();
    audioEpoch++;
    musicRequest += 1; musicPending = false;
    cancelPunch();
    lastShortMiss = -1;
    for (const voice of [...voices]) stop(voice);
    recent.clear(); failed.clear();
    music?.pause(); if (music) music.removeAttribute('src');
    bag = [];
  }
  return {preload, prepare, unlock, play, achievement, duration, beginHaki, cancelHaki, hakiTime, beginKick, impactKick, cancelKick: () => stop(kickVoice), setActive, reset,
    beginPunch, releasePunch, impactPunch, returnArm, cancelPunch, cancelCharge, shortPunchMiss,
    setMuted(value) { muted = !!value; if (master) master.gain.value = muted ? 0 : 1; if (muted) { audioEpoch++; for (const voice of [...voices]) stop(voice); } },
    get muted() { return muted; }};
}
