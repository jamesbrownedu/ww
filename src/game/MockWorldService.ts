import type {
  BootstrapData,
  OccupantDefinition,
  RoomDefinition,
  RoomSession,
  WorldService,
} from './types'

const rooms: RoomDefinition[] = [
  {
    id: 'hub',
    name: 'Transit Hub',
    description: 'A small social spawn with sightlines, pads, and room switching.',
    spawn: { x: 0, y: 0, z: 8 },
    bounds: { width: 38, depth: 38 },
    palette: {
      background: '#0a1822',
      fog: '#112739',
      floor: '#173447',
      surface: '#284d63',
      accent: '#4dc7ff',
      emissive: '#2c84af',
    },
    props: [
      { kind: 'pad', position: { x: 0, y: 0.05, z: 0 }, size: { x: 3.2, y: 0.2, z: 3.2 } },
      { kind: 'box', position: { x: -7, y: 1.5, z: -7 }, size: { x: 3, y: 3, z: 3 } },
      { kind: 'box', position: { x: 7, y: 2.5, z: -6 }, size: { x: 4, y: 5, z: 4 } },
      { kind: 'pillar', position: { x: -12, y: 2.5, z: 8 }, size: { x: 1.4, y: 5, z: 1.4 } },
      { kind: 'pillar', position: { x: 12, y: 2.5, z: 8 }, size: { x: 1.4, y: 5, z: 1.4 } },
      { kind: 'pad', position: { x: 10, y: 0.05, z: 10 }, size: { x: 4, y: 0.2, z: 4 } },
    ],
  },
  {
    id: 'loft',
    name: 'Loft Run',
    description: 'A flatscreen traversal room with staggered platforms and longer lanes.',
    spawn: { x: 0, y: 0, z: 10 },
    bounds: { width: 46, depth: 30 },
    palette: {
      background: '#11161b',
      fog: '#222b35',
      floor: '#252d37',
      surface: '#47596a',
      accent: '#a0d25f',
      emissive: '#4d6e1f',
    },
    props: [
      { kind: 'box', position: { x: -10, y: 1, z: 2 }, size: { x: 4, y: 2, z: 4 } },
      { kind: 'box', position: { x: -2, y: 2, z: -2 }, size: { x: 4, y: 4, z: 4 } },
      { kind: 'box', position: { x: 6, y: 3, z: -6 }, size: { x: 5, y: 6, z: 5 } },
      { kind: 'box', position: { x: 15, y: 1.25, z: -10 }, size: { x: 6, y: 2.5, z: 6 } },
      { kind: 'pad', position: { x: 15, y: 0.05, z: 7 }, size: { x: 5, y: 0.2, z: 5 } },
      { kind: 'pillar', position: { x: -18, y: 3.5, z: -8 }, size: { x: 1.6, y: 7, z: 1.6 } },
    ],
  },
  {
    id: 'arena',
    name: 'Arena Loop',
    description: 'A compact combat-style volume with strong contrast and fast sight checks.',
    spawn: { x: 0, y: 0, z: 11 },
    bounds: { width: 42, depth: 42 },
    palette: {
      background: '#18100c',
      fog: '#2c1d15',
      floor: '#3a261d',
      surface: '#6b4937',
      accent: '#ff9b4a',
      emissive: '#a35a1f',
    },
    props: [
      { kind: 'pillar', position: { x: -10, y: 3, z: -10 }, size: { x: 1.8, y: 6, z: 1.8 } },
      { kind: 'pillar', position: { x: 10, y: 3, z: -10 }, size: { x: 1.8, y: 6, z: 1.8 } },
      { kind: 'pillar', position: { x: -10, y: 3, z: 10 }, size: { x: 1.8, y: 6, z: 1.8 } },
      { kind: 'pillar', position: { x: 10, y: 3, z: 10 }, size: { x: 1.8, y: 6, z: 1.8 } },
      { kind: 'box', position: { x: 0, y: 1.5, z: 0 }, size: { x: 7, y: 3, z: 7 } },
      { kind: 'pad', position: { x: 0, y: 0.05, z: -14 }, size: { x: 4.5, y: 0.2, z: 4.5 } },
    ],
  },
]

const occupantsByRoom: Record<string, OccupantDefinition[]> = {
  hub: [
    { id: 'mentor', displayName: 'Mentor', color: '#4dc7ff', position: { x: -6, y: 0, z: 2 } },
    { id: 'builder', displayName: 'Builder', color: '#7be08f', position: { x: 6, y: 0, z: -1 } },
  ],
  loft: [
    { id: 'runner', displayName: 'Runner', color: '#a0d25f', position: { x: -9, y: 0, z: 4 } },
    { id: 'spotter', displayName: 'Spotter', color: '#f6c35b', position: { x: 13, y: 0, z: -7 } },
  ],
  arena: [
    { id: 'anchor', displayName: 'Anchor', color: '#ff9b4a', position: { x: -8, y: 0, z: -8 } },
    { id: 'scout', displayName: 'Scout', color: '#f26b6b', position: { x: 8, y: 0, z: 8 } },
    { id: 'wing', displayName: 'Wing', color: '#ffd670', position: { x: -8, y: 0, z: 9 } },
  ],
}

const bootstrapData: BootstrapData = {
  profile: {
    id: 'local-prototype',
    displayName: 'Prototype Traveler',
    status: 'Local mock session',
  },
  rooms,
  transportMode: 'Offline mock service',
  voiceMode: 'Disabled',
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export class MockWorldService implements WorldService {
  async getBootstrap(): Promise<BootstrapData> {
    await delay(120)
    return bootstrapData
  }

  async joinRoom(roomId: string): Promise<RoomSession> {
    await delay(90)

    const room = rooms.find((candidate) => candidate.id === roomId)

    if (!room) {
      throw new Error(`Unknown room "${roomId}".`)
    }

    return {
      room,
      occupants: occupantsByRoom[roomId] ?? [],
      transportMode: 'Offline mock service',
      voiceMode: 'Disabled',
    }
  }
}
