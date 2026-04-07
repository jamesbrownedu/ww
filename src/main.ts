import './style.css'
import { BrowserClient } from './game/BrowserClient'
import { MockWorldService } from './game/MockWorldService'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App container not found.')
}

app.innerHTML = `
  <div class="app-shell">
    <div id="viewport"></div>

    <aside class="hud hud-left">
      <section class="panel">
        <p class="eyebrow">Browser-first rebuild</p>
        <h1 id="room-name">Booting session</h1>
        <p id="room-description">
          Preparing a clean WebGL client with flatscreen controls and browser-safe boundaries.
        </p>
      </section>

      <section class="panel">
        <div class="stat-row">
          <span>Profile</span>
          <strong id="profile-name">Loading</strong>
        </div>
        <div class="stat-row">
          <span>Transport</span>
          <strong id="transport-mode">Loading</strong>
        </div>
        <div class="stat-row">
          <span>Voice</span>
          <strong id="voice-mode">Loading</strong>
        </div>
        <div class="stat-row">
          <span>Session</span>
          <strong id="session-state">Booting</strong>
        </div>
      </section>
    </aside>

    <aside class="hud hud-right">
      <section class="panel">
        <p class="panel-title">Rooms</p>
        <div id="room-list" class="button-stack"></div>
      </section>

      <section class="panel">
        <p class="panel-title">People</p>
        <ul id="occupant-list" class="occupant-list"></ul>
      </section>
    </aside>

    <div id="center-overlay" class="center-overlay">
      <section class="panel center-panel">
        <p class="eyebrow">WebGL prototype</p>
        <h2>Enter world</h2>
        <p>
          Start the session, then use mouse look, <code>WASD</code>, <code>Space</code>, and
          <code>Shift</code>.
        </p>
        <button id="enter-button" type="button">Start session</button>
      </section>
    </div>

    <div class="crosshair" aria-hidden="true"></div>

    <div class="footer-bar">
      <div class="footer-strip" id="footer-status">
        Local mock mode. No legacy backend, native plugin, or VR dependency is active here.
      </div>
    </div>
  </div>
`

const client = new BrowserClient(new MockWorldService(), {
  mount: document.querySelector<HTMLElement>('#viewport')!,
  roomName: document.querySelector<HTMLElement>('#room-name')!,
  roomDescription: document.querySelector<HTMLElement>('#room-description')!,
  profileName: document.querySelector<HTMLElement>('#profile-name')!,
  transportMode: document.querySelector<HTMLElement>('#transport-mode')!,
  voiceMode: document.querySelector<HTMLElement>('#voice-mode')!,
  sessionState: document.querySelector<HTMLElement>('#session-state')!,
  roomList: document.querySelector<HTMLElement>('#room-list')!,
  occupantList: document.querySelector<HTMLElement>('#occupant-list')!,
  centerOverlay: document.querySelector<HTMLElement>('#center-overlay')!,
  enterButton: document.querySelector<HTMLButtonElement>('#enter-button')!,
  footerStatus: document.querySelector<HTMLElement>('#footer-status')!,
})

void client.init().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)

  client.setStartupFailure(message)
  console.error(error)
})
