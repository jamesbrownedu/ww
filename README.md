# Rec High WebGL Client

This is a clean browser-first prototype. It does not reuse the shipped Unity desktop runtime, native plugins, or the unsafe backend project file.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Current scope

- WebGL scene rendered with Three.js
- Mouse look plus `WASD` / `Space` / `Shift`
- Room switching through a mock browser-safe service
- Mock remote occupants for scene validation

## Important files

- `src/game/BrowserClient.ts`
- `src/game/MockWorldService.ts`
- `src/game/types.ts`
