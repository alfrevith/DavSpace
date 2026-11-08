const icon = (paths, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;
const left = icon('<path d="m14 6-6 6 6 6M8 12h11"/>');
const right = icon('<path d="m10 6 6 6-6 6M5 12h11"/>');
const jump = icon('<path d="M12 19V5m-5 5 5-5 5 5M5 21h14"/>');
const attack = icon('<path d="m14 3-2 7 7-1-9 12 2-8-7 1 9-11Z"/>');
const play = icon('<path d="m9 5 10 7-10 7V5Z"/>');
const pause = icon('<path d="M8 5v14M16 5v14"/>');
const reset = icon('<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>');

/** Intentionally absent from the main navigation and its scroll-section list. */
export function characterPlaygroundMarkup({ mobile = false } = {}) {
  return `<!-- character-playground:start -->
<section class="playground" id="playground" data-character-playground aria-labelledby="playground-title">
  <span class="playground-eyebrow${mobile ? ' mobile-eyebrow' : ''}">playground/&gt;</span>
  <header class="playground-heading">
    <div><p class="playground-kicker">ARCADE / ENDLESS SURVIVAL</p><h2 id="playground-title">Marine siege.<br><em>Endless survival.</em></h2></div>
    <p class="playground-intro">Fight the marines. Charge Gear Second.<br>Unlock a discovery every 15 kills.</p>
  </header>
  <div class="game-shell">
    <div class="game-hud" aria-label="Survival statistics" aria-live="off">
      <div class="game-hud-health game-hud-panel"><span class="game-hud-emblem game-hud-emblem--health" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.8 13a5.7 5.7 0 0 1 8.2-7.9 5.7 5.7 0 0 1 8.2 7.9Z"/></svg></span><div class="game-hud-copy"><div class="game-hud-heading"><span class="game-hud-label">HEALTH</span><span class="game-health-number"><strong data-game-health-value>100</strong><small>/ 100</small></span></div><div class="game-health-meter" data-game-health role="meter" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="game-health-trail" data-game-health-trail></span><span data-game-health-bar></span></div></div></div>
      <p class="game-hud-stat game-hud-time game-hud-panel"><span class="game-hud-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 0v3m0 3v5l3 2"/></svg></span><span class="game-hud-copy"><span class="game-hud-label">TIME</span><strong data-game-time>0:00</strong></span></p>
      <p class="game-hud-stat game-hud-kills game-hud-panel"><span class="game-hud-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m5 3 15 15-2 2L3 5V3h2Zm14 0L4 18l2 2L21 5V3h-2ZM2 16l6 6m8 0 6-6"/></svg></span><span class="game-hud-copy"><span class="game-hud-label">KILLS</span><strong data-game-kills>0</strong></span></p>
      <div class="game-hud-gear game-hud-panel"><span class="game-hud-emblem game-hud-emblem--gear" aria-hidden="true"><b>G2</b></span><div class="game-hud-copy"><div class="game-hud-heading"><span class="game-hud-label">GEAR 2</span><b class="game-gear-number" data-game-gear-time>0%</b></div><div class="game-charge-meter" data-game-charge role="meter" aria-label="Gear Second charge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-game-charge-bar></span></div><span class="game-hud-gear-note" data-game-gear-note>Charge with kills</span><span class="game-gear-prompt" data-game-gear-prompt hidden><span class="game-gear-prompt-keyboard">Press <kbd>G</kbd><span class="game-gear-prompt-tail"> to activate</span></span><span class="game-gear-prompt-touch">Tap <b>G2</b><span class="game-gear-prompt-tail"> to activate</span></span></span></div></div>
    </div>
    <div class="game-arena-slot">
      <button class="game-haki-tool" type="button" data-game-haki disabled aria-label="Conqueror Haki unlocks at 1:00. K"><strong>K</strong><span class="game-haki-name">Haki</span><span data-game-haki-label>1:00</span></button>
      <div class="game-toolbar">
        <div class="game-toolbar-actions">
          <button class="game-tool game-fullscreen-tool" type="button" data-game-fullscreen aria-label="Play in fullscreen" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg><span>Fullscreen</span></button>
          <button class="game-tool game-sound-tool" type="button" data-game-sound aria-label="Mute game audio" aria-pressed="false" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="game-sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="game-sound-slash" d="m3 3 18 18"/></svg><span>Sound</span></button>
          <button class="game-tool" type="button" data-game-pause aria-label="Pause game" disabled hidden>${pause}<span>Pause</span></button>
          <button class="game-tool" type="button" data-game-reset aria-label="Restart character" disabled>${reset}<span>Restart</span></button>
        </div>
      </div>
      <div class="game-stage" data-game-stage>
      <canvas class="game-canvas" data-game-canvas width="960" height="480" tabindex="0" aria-label="Survival arena. Move with A and D or the arrow keys, jump with Space, and attack with a mouse click or J. Hold attack and release for a stronger punch. Attack while airborne for a diving kick. Defeat marines to charge Gear Second, then press G for temporary power and healing." aria-describedby="game-instructions">This playground needs a browser with Canvas support. You can continue exploring the portfolio below.</canvas>
      <div class="game-overlay" data-game-overlay>
        <div class="game-overlay-copy">
          <div class="game-menu-hero" data-game-menu-hero aria-hidden="true"></div>
          <div class="game-menu-body">
            <span class="game-overlay-mark" data-game-menu-label>ENDLESS SURVIVAL</span>
            <p class="game-overlay-title" data-game-title>Marine siege</p>
            <p class="game-overlay-note" data-game-help role="status" aria-live="polite" aria-atomic="true">Defeat marines. Dodge cannon fire. Stay alive.</p>
            <p class="game-run-summary" data-game-summary hidden></p>
            <div class="game-menu-buttons"><button class="game-start" type="button" data-game-start disabled>${play}<span>Loading…</span></button><button class="game-menu-restart" data-game-menu-reset type="button" hidden>Restart</button></div>
            <p class="game-menu-guide"><kbd>A / D</kbd> Move <kbd>Space</kbd> Jump <kbd>J</kbd> Attack</p>
            <p class="game-menu-touch-guide">Use the controls below.</p>
          </div>
        </div>
      </div>
      <span class="game-stage-corner game-stage-corner--top" aria-hidden="true"></span>
      <span class="game-stage-corner game-stage-corner--bottom" aria-hidden="true"></span>
    </div>
    </div>
    <div class="game-achievement-slot" role="status" aria-live="polite" aria-atomic="true">
      <p class="game-achievement-waiting" aria-hidden="true">Next discovery in <b data-game-discovery-remaining>15</b> kills</p>
      <div class="game-achievement" data-game-achievement hidden><span class="game-achievement-label">Achievement unlocked!</span><p data-game-achievement-text></p></div>
    </div>
    <div class="game-touch-controls" aria-label="Touch game controls">
      <div class="game-control-group" aria-label="Movement">
        <button class="game-control game-control--direction" type="button" data-game-control="left" aria-label="Run left" disabled>${left}<span>Left</span></button>
        <button class="game-control game-control--direction" type="button" data-game-control="right" aria-label="Run right" disabled>${right}<span>Right</span></button>
      </div>
      <div class="game-control-group" aria-label="Actions">
        <button class="game-control game-control--jump" type="button" data-game-control="jump" aria-label="Jump. Hold for a higher jump." disabled>${jump}<span>Jump</span></button>
        <button class="game-control game-control--attack" type="button" data-game-control="attack" aria-label="Hold Attack to charge, then release to punch. Tap in the air for a diving kick." disabled>${attack}<span>Attack</span></button>
        <button class="game-control game-control--gear" type="button" data-game-gear aria-label="Activate Gear Second when charged. G" aria-pressed="false" disabled><strong>G2</strong><span data-game-gear-label>0%</span></button>
      </div>
    </div>
  </div>
  <div class="game-orientation" data-game-orientation hidden role="dialog" aria-modal="true" aria-labelledby="game-rotate-title"><div class="game-orientation-card"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="16" y="9" width="31" height="46" rx="5" transform="rotate(90 32 32)"/><path d="M11 17a24 24 0 0 1 39-3m0-8v8h-8M53 47a24 24 0 0 1-39 3m0 8v-8h8"/></svg><p id="game-rotate-title" data-game-rotate-title>Turn your phone</p><span data-game-rotate-copy>Play in landscape for the full arena and both sets of controls.</span><div><button class="game-start" data-game-continue type="button" hidden>Continue</button><button class="game-menu-restart" data-game-leave type="button">Back to portfolio</button></div></div></div>
  <div class="game-instructions" id="game-instructions">
    <div class="game-keyboard-guide"><p><kbd>A</kbd><kbd>D</kbd><span>or</span><kbd>←</kbd><kbd>→</kbd><span>Move</span></p><p><kbd>Space</kbd><span>Jump</span></p><p><kbd>Click</kbd><span>or</span><kbd>J</kbd><span>Attack</span></p><p><kbd>G</kbd><span>Gear 2</span></p><p><kbd>K</kbd><span>Haki</span></p></div>
    <p class="game-tip">Hold Attack to charge. Release to punch.<br class="game-tip-break"> Gear Second restores all health.</p>
  </div>
  <details class="game-records" data-game-records><summary><span>Discoveries <b data-game-record-count>0</b></span><span class="game-records-hint">Saved discoveries <i aria-hidden="true">+</i></span></summary><div class="game-records-content"><p class="game-records-intro">Facts from this portfolio. Opening this list pauses the game.</p><p class="game-records-empty" data-game-record-empty>Get 15 kills in a run to unlock your first discovery.</p><ol class="game-record-list" data-game-record-list></ol></div></details>
  <span class="game-a11y-message" data-game-announcement role="status" aria-live="polite" aria-atomic="true"></span>
  <noscript><p class="game-noscript">Enable JavaScript to play with the character. The rest of the portfolio is ready to explore.</p></noscript>
</section>
<!-- character-playground:end -->`;
}
