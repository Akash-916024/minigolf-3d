export interface HudCallbacks {
  onResetCamera: () => void;
  onToggleMute: () => boolean;
  onReplayHole: () => void;
}

/**
 * Manages the Apple-grade glassmorphic HUD overlay:
 * hole/stroke/best readout, power toast, OOB notice, and hole-complete modal.
 */
export class HudManager {
  private readonly strokesEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly powerToast: HTMLElement;
  private readonly statusBanner: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly modalBackdrop: HTMLElement;
  private readonly modalBadge: HTMLElement;
  private readonly modalTitle: HTMLElement;
  private readonly modalStrokes: HTMLElement;
  private readonly modalBest: HTMLElement;
  private statusTimer: number | null = null;

  constructor(root: HTMLElement, par: number, callbacks: HudCallbacks) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="glass-pill score-pill">
          <div class="score-segment">
            <span class="score-label">Hole</span>
            <span class="score-value">1 • Par ${par}</span>
          </div>
          <div class="divider"></div>
          <div class="score-segment">
            <span class="score-label">Strokes</span>
            <span class="score-value" id="hud-strokes">0</span>
          </div>
          <div class="divider"></div>
          <div class="score-segment">
            <span class="score-label">Best</span>
            <span class="score-value" id="hud-best">--</span>
          </div>
        </div>

        <div class="glass-pill venue-badge">
          <span class="venue-dot"></span>
          <span>Pine Forest • Phase 1</span>
        </div>
      </div>

      <div class="hud-center-status">
        <div class="status-banner" id="hud-status-banner">Out of Bounds (+1 Penalty)</div>
        <div class="power-toast" id="hud-power-toast">Power 0%</div>
      </div>

      <div class="hud-bottom">
        <div class="glass-pill controls-hint">
          <strong>Putt:</strong> Drag back &amp; release (center cancels)<br />
          <strong>Camera:</strong> Right-drag / 2-finger orbit &bull; Scroll / Pinch zoom
        </div>

        <div class="action-group">
          <button class="hud-btn" id="btn-reset-cam" type="button">Reset View</button>
          <button class="hud-btn" id="btn-mute" type="button">Sound: On</button>
        </div>
      </div>

      <div class="modal-backdrop" id="hole-modal">
        <div class="modal-card">
          <div class="modal-badge" id="modal-badge">Par</div>
          <h2 class="modal-title" id="modal-title">Hole Complete!</h2>
          <p class="modal-subtitle">Pine Forest &bull; Hole 1</p>
          <div class="modal-stats">
            <div class="stat-box">
              <div class="score-label">Par</div>
              <div class="score-value">${par}</div>
            </div>
            <div class="stat-box">
              <div class="score-label">Strokes</div>
              <div class="score-value" id="modal-strokes">0</div>
            </div>
            <div class="stat-box">
              <div class="score-label">Best</div>
              <div class="score-value" id="modal-best">--</div>
            </div>
          </div>
          <button class="primary-btn" id="btn-replay" type="button">Play Hole Again</button>
        </div>
      </div>
    `;

    this.strokesEl = root.querySelector('#hud-strokes')!;
    this.bestEl = root.querySelector('#hud-best')!;
    this.powerToast = root.querySelector('#hud-power-toast')!;
    this.statusBanner = root.querySelector('#hud-status-banner')!;
    this.muteBtn = root.querySelector('#btn-mute')!;
    this.modalBackdrop = root.querySelector('#hole-modal')!;
    this.modalBadge = root.querySelector('#modal-badge')!;
    this.modalTitle = root.querySelector('#modal-title')!;
    this.modalStrokes = root.querySelector('#modal-strokes')!;
    this.modalBest = root.querySelector('#modal-best')!;

    root.querySelector('#btn-reset-cam')?.addEventListener('click', callbacks.onResetCamera);
    this.muteBtn.addEventListener('click', () => {
      const muted = callbacks.onToggleMute();
      this.muteBtn.textContent = muted ? 'Sound: Off' : 'Sound: On';
    });
    root.querySelector('#btn-replay')?.addEventListener('click', callbacks.onReplayHole);
  }

  public setStrokes(strokes: number): void {
    this.strokesEl.textContent = String(strokes);
  }

  public setBest(best: number | null): void {
    this.bestEl.textContent = best === null ? '--' : String(best);
  }

  public setPowerReadout(active: boolean, cancelled: boolean, power: number): void {
    if (!active) {
      this.powerToast.classList.remove('visible');
      return;
    }
    this.powerToast.classList.add('visible');
    this.powerToast.textContent = cancelled ? 'Release to Cancel' : `Power ${Math.round(power * 100)}%`;
  }

  public showBanner(message: string): void {
    this.statusBanner.textContent = message;
    this.statusBanner.classList.add('visible');
    if (this.statusTimer !== null) {
      window.clearTimeout(this.statusTimer);
    }
    this.statusTimer = window.setTimeout(() => {
      this.statusBanner.classList.remove('visible');
      this.statusTimer = null;
    }, 1800);
  }

  public showHoleComplete(strokes: number, par: number, best: number): void {
    const diff = strokes - par;
    let label = 'Par';
    if (strokes === 1) label = 'Hole-in-One!';
    else if (diff <= -2) label = 'Eagle!';
    else if (diff === -1) label = 'Birdie!';
    else if (diff === 1) label = 'Bogey';
    else if (diff >= 2) label = `+${diff} Over Par`;

    this.modalBadge.textContent = label;
    this.modalTitle.textContent = strokes === 1 ? 'Unbelievable Shot!' : 'Hole Complete!';
    this.modalStrokes.textContent = String(strokes);
    this.modalBest.textContent = String(best);
    this.modalBackdrop.classList.add('open');
  }

  public hideHoleComplete(): void {
    this.modalBackdrop.classList.remove('open');
  }
}

