export interface HudCallbacks {
  onResetCamera: () => void;
  onResetBall: () => void;
  onToggleMute: () => boolean;
  onReplayHole: () => void;
  onNextHole: () => void;
  onSwitchHole: () => void;
}

/**
 * Manages the Apple-grade glassmorphic HUD overlay:
 * hole/stroke/best readout, live Wind Compass, power toast,
 * OOB/hazard banners, course switcher, and hole-complete modal.
 */
export class HudManager {
  private readonly holeParEl: HTMLElement;
  private readonly strokesEl: HTMLElement;
  private readonly bestEl: HTMLElement;
  private readonly venueTextEl: HTMLElement;
  private readonly windPill: HTMLElement;
  private readonly windArrow: HTMLElement;
  private readonly windSpeedEl: HTMLElement;
  private readonly powerToast: HTMLElement;
  private readonly statusBanner: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly switchBtn: HTMLButtonElement;
  private readonly modalBackdrop: HTMLElement;
  private readonly modalBadge: HTMLElement;
  private readonly modalTitle: HTMLElement;
  private readonly modalSubtitle: HTMLElement;
  private readonly modalPar: HTMLElement;
  private readonly modalStrokes: HTMLElement;
  private readonly modalBest: HTMLElement;
  private statusTimer: number | null = null;

  constructor(root: HTMLElement, callbacks: HudCallbacks) {
    root.innerHTML = `
      <div class="hud-top">
        <div class="glass-pill score-pill">
          <div class="score-segment">
            <span class="score-label">Hole</span>
            <span class="score-value" id="hud-hole-par">1 &bull; Par 3</span>
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

        <div class="hud-top-right">
          <div class="glass-pill wind-pill hidden" id="hud-wind-pill" aria-label="Wind indicator">
            <div class="wind-arrow-wrap">
              <svg class="wind-arrow" id="hud-wind-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
            <span id="hud-wind-speed">0.0 m/s</span>
          </div>

          <div class="glass-pill venue-badge">
            <span class="venue-dot"></span>
            <span id="hud-venue-text">Pine Forest</span>
          </div>
        </div>
      </div>

      <div class="hud-center-status">
        <div class="status-banner" id="hud-status-banner">Out of Bounds (+1 Penalty)</div>
        <div class="power-toast" id="hud-power-toast">Power 0%</div>
      </div>

      <div class="hud-bottom">
        <div class="glass-pill controls-hint">
          <strong>Putt:</strong> Drag from ball (1%&ndash;100% power)<br />
          <strong>Camera:</strong> Drag elsewhere / Right-drag orbit &bull; Scroll / Pinch zoom
        </div>

        <div class="action-group">
          <button class="hud-btn" id="btn-switch-hole" type="button">Switch Hole</button>
          <button class="hud-btn" id="btn-reset-ball" type="button">Reset Ball</button>
          <button class="hud-btn" id="btn-reset-cam" type="button">Reset View</button>
          <button class="hud-btn" id="btn-mute" type="button">Sound: On</button>
        </div>
      </div>

      <div class="modal-backdrop" id="hole-modal">
        <div class="modal-card">
          <div class="modal-badge" id="modal-badge">Par</div>
          <h2 class="modal-title" id="modal-title">Hole Complete!</h2>
          <p class="modal-subtitle" id="modal-subtitle">Pine Forest &bull; Hole 1</p>
          <div class="modal-stats">
            <div class="stat-box">
              <div class="score-label">Par</div>
              <div class="score-value" id="modal-par">3</div>
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
          <div class="modal-actions">
            <button class="secondary-btn" id="btn-replay" type="button">Play Again</button>
            <button class="primary-btn" id="btn-next-hole" type="button">Next Hole</button>
          </div>
        </div>
      </div>
    `;

    this.holeParEl = root.querySelector('#hud-hole-par')!;
    this.strokesEl = root.querySelector('#hud-strokes')!;
    this.bestEl = root.querySelector('#hud-best')!;
    this.venueTextEl = root.querySelector('#hud-venue-text')!;
    this.windPill = root.querySelector('#hud-wind-pill')!;
    this.windArrow = root.querySelector('#hud-wind-arrow')!;
    this.windSpeedEl = root.querySelector('#hud-wind-speed')!;
    this.powerToast = root.querySelector('#hud-power-toast')!;
    this.statusBanner = root.querySelector('#hud-status-banner')!;
    this.muteBtn = root.querySelector('#btn-mute')!;
    this.switchBtn = root.querySelector('#btn-switch-hole')!;
    this.modalBackdrop = root.querySelector('#hole-modal')!;
    this.modalBadge = root.querySelector('#modal-badge')!;
    this.modalTitle = root.querySelector('#modal-title')!;
    this.modalSubtitle = root.querySelector('#modal-subtitle')!;
    this.modalPar = root.querySelector('#modal-par')!;
    this.modalStrokes = root.querySelector('#modal-strokes')!;
    this.modalBest = root.querySelector('#modal-best')!;

    root.querySelector('#btn-reset-cam')?.addEventListener('click', callbacks.onResetCamera);
    root.querySelector('#btn-reset-ball')?.addEventListener('click', callbacks.onResetBall);
    this.switchBtn.addEventListener('click', callbacks.onSwitchHole);
    this.muteBtn.addEventListener('click', () => {
      const muted = callbacks.onToggleMute();
      this.muteBtn.textContent = muted ? 'Sound: Off' : 'Sound: On';
    });
    root.querySelector('#btn-replay')?.addEventListener('click', callbacks.onReplayHole);
    root.querySelector('#btn-next-hole')?.addEventListener('click', callbacks.onNextHole);
  }

  public setHoleInfo(
    holeNumber: number,
    holeName: string,
    venueLabel: string,
    par: number,
    best: number | null,
    nextLabel: string
  ): void {
    this.holeParEl.textContent = `${holeNumber} • Par ${par}`;
    this.venueTextEl.textContent = `${venueLabel} • ${holeName}`;
    this.modalSubtitle.textContent = `${venueLabel} • Hole ${holeNumber} (${holeName})`;
    this.modalPar.textContent = String(par);
    this.switchBtn.textContent = nextLabel;
    this.setBest(best);
    this.setStrokes(0);
  }

  public setStrokes(strokes: number): void {
    this.strokesEl.textContent = String(strokes);
  }

  public setBest(best: number | null): void {
    this.bestEl.textContent = best === null ? '--' : String(best);
  }

  /** Rotate HUD wind arrow relative to current camera yaw so direction matches screen space. */
  public setWind(windX: number, windZ: number, cameraYaw: number): void {
    const speed = Math.hypot(windX, windZ);
    if (speed < 0.05) {
      this.windPill.classList.add('hidden');
      return;
    }

    this.windPill.classList.remove('hidden');
    this.windSpeedEl.textContent = `${speed.toFixed(1)} m/s`;

    // World wind angle (0 = -Z forward on screen when cameraYaw = 0)
    const worldAngle = Math.atan2(windX, -windZ);
    const screenAngleRad = worldAngle + cameraYaw;
    const deg = (screenAngleRad * 180) / Math.PI;
    this.windArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
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
