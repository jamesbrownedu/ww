export interface Vector3Like {
  x: number
  y: number
  z: number
}

export interface RoomPalette {
  background: string
  fog: string
  floor: string
  surface: string
  accent: string
  emissive: string
}

export interface RoomProp {
  kind: 'box' | 'pillar' | 'pad'
  position: Vector3Like
  size: Vector3Like
  color?: string
  emissive?: string
}

export interface RoomBounds {
  width: number
  depth: number
}

export interface RoomDefinition {
  id: string
  name: string
  description: string
  spawn: Vector3Like
  bounds: RoomBounds
  palette: RoomPalette
  props: RoomProp[]
}

export interface OccupantDefinition {
  id: string
  displayName: string
  color: string
  position: Vector3Like
}

export interface PlayerProfile {
  id: string
  displayName: string
  status: string
}

export interface BootstrapData {
  profile: PlayerProfile
  rooms: RoomDefinition[]
  transportMode: string
  voiceMode: string
}

export interface RoomSession {
  room: RoomDefinition
  occupants: OccupantDefinition[]
  transportMode: string
  voiceMode: string
}

export interface WorldService {
  getBootstrap(): Promise<BootstrapData>
  joinRoom(roomId: string): Promise<RoomSession>
}
