import * as THREE from 'three'
import type {
  BootstrapData,
  OccupantDefinition,
  RoomDefinition,
  WorldService,
} from './types'

const EYE_HEIGHT = 1.65
const WALK_SPEED = 5.5
const RUN_SPEED = 8.5
const JUMP_SPEED = 5.1
const GRAVITY = 15
const LOOK_SENSITIVITY = 0.0018
const MAX_DELTA = 0.05

type UiRefs = {
  mount: HTMLElement
  roomName: HTMLElement
  roomDescription: HTMLElement
  profileName: HTMLElement
  transportMode: HTMLElement
  voiceMode: HTMLElement
  sessionState: HTMLElement
  roomList: HTMLElement
  occupantList: HTMLElement
  centerOverlay: HTMLElement
  enterButton: HTMLButtonElement
  footerStatus: HTMLElement
}

type OccupantVisual = {
  root: THREE.Group
  baseY: number
  phase: number
}

export class BrowserClient {
  private readonly service: WorldService
  private readonly ui: UiRefs
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  private readonly playerYaw = new THREE.Group()
  private readonly playerPitch = new THREE.Group()
  private readonly roomRoot = new THREE.Group()
  private readonly occupantRoot = new THREE.Group()
  private readonly pressedKeys = new Set<string>()
  private readonly clock = new THREE.Clock()
  private readonly directionLight = new THREE.DirectionalLight('#ffffff', 1.4)

  private bootstrap?: BootstrapData
  private activeRoom?: RoomDefinition
  private occupantVisuals: OccupantVisual[] = []
  private floorGrid?: THREE.GridHelper
  private verticalVelocity = 0
  private grounded = true
  private pointerLocked = false
  private joining = false

  constructor(service: WorldService, ui: UiRefs) {
    this.service = service
    this.ui = ui
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.className = 'scene-canvas'
  }

  async init(): Promise<void> {
    this.mountRenderer()
    this.configureScene()
    this.bindEvents()
    this.setSessionState('Booting')

    this.bootstrap = await this.service.getBootstrap()

    this.ui.profileName.textContent = this.bootstrap.profile.displayName
    this.ui.transportMode.textContent = this.bootstrap.transportMode
    this.ui.voiceMode.textContent = this.bootstrap.voiceMode
    this.renderRoomButtons(this.bootstrap.rooms)

    if (this.bootstrap.rooms.length === 0) {
      throw new Error('No rooms are available in bootstrap data.')
    }

    await this.joinRoom(this.bootstrap.rooms[0].id)

    this.clock.start()
    this.animate()
  }

  setStartupFailure(message: string): void {
    this.setSessionState('Failed')
    this.ui.roomName.textContent = 'Startup failed'
    this.ui.roomDescription.textContent = message
    this.ui.footerStatus.textContent = message
    this.ui.centerOverlay.hidden = false
  }

  private mountRenderer(): void {
    this.ui.mount.replaceChildren(this.renderer.domElement)
    this.resize()
  }

  private configureScene(): void {
    this.scene.background = new THREE.Color('#0a1822')
    this.scene.fog = new THREE.Fog('#112739', 14, 70)

    const hemisphere = new THREE.HemisphereLight('#dbeeff', '#1a232c', 1.25)
    this.scene.add(hemisphere)

    this.directionLight.position.set(12, 18, 10)
    this.directionLight.castShadow = true
    this.directionLight.shadow.mapSize.set(2048, 2048)
    this.directionLight.shadow.camera.near = 0.5
    this.directionLight.shadow.camera.far = 80
    this.directionLight.shadow.camera.left = -32
    this.directionLight.shadow.camera.right = 32
    this.directionLight.shadow.camera.top = 32
    this.directionLight.shadow.camera.bottom = -32
    this.scene.add(this.directionLight)

    this.playerYaw.position.set(0, EYE_HEIGHT, 8)
    this.playerPitch.add(this.camera)
    this.playerYaw.add(this.playerPitch)
    this.scene.add(this.playerYaw)
    this.scene.add(this.roomRoot)
    this.scene.add(this.occupantRoot)
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    document.addEventListener('mousemove', this.onMouseMove)

    this.ui.enterButton.addEventListener('click', this.requestPointerLock)
    this.renderer.domElement.addEventListener('click', this.requestPointerLock)
  }

  private readonly resize = (): void => {
    const width = Math.max(this.ui.mount.clientWidth, 1)
    const height = Math.max(this.ui.mount.clientHeight, 1)

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.pressedKeys.clear()
  }

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement
    this.ui.centerOverlay.hidden = this.pointerLocked
    this.ui.footerStatus.textContent = this.pointerLocked
      ? 'Session live. Move with WASD, jump with Space, sprint with Shift, and press Escape to release.'
      : 'Pointer released. Click Start session or the viewport to continue.'
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.pointerLocked) {
      return
    }

    this.playerYaw.rotation.y -= event.movementX * LOOK_SENSITIVITY
    this.playerPitch.rotation.x = THREE.MathUtils.clamp(
      this.playerPitch.rotation.x - event.movementY * LOOK_SENSITIVITY,
      -1.15,
      1.15,
    )
  }

  private readonly requestPointerLock = (): void => {
    void this.renderer.domElement.requestPointerLock()
  }

  private renderRoomButtons(rooms: RoomDefinition[]): void {
    this.ui.roomList.replaceChildren()

    for (const room of rooms) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'room-button'
      button.textContent = room.name
      button.addEventListener('click', () => {
        void this.joinRoom(room.id)
      })
      this.ui.roomList.appendChild(button)
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    if (this.joining) {
      return
    }

    this.joining = true
    this.setSessionState('Joining')

    try {
      const session = await this.service.joinRoom(roomId)

      this.activeRoom = session.room
      this.ui.roomName.textContent = session.room.name
      this.ui.roomDescription.textContent = session.room.description
      this.ui.transportMode.textContent = session.transportMode
      this.ui.voiceMode.textContent = session.voiceMode
      this.ui.footerStatus.textContent = `Loaded ${session.room.name} with ${session.occupants.length} remote occupants in mock mode.`

      this.rebuildRoom(session.room)
      this.rebuildOccupants(session.occupants)
      this.positionPlayerAtSpawn(session.room)
      this.markActiveRoomButton(roomId)
      this.setSessionState('Live')
    } finally {
      this.joining = false
    }
  }

  private markActiveRoomButton(roomId: string): void {
    const buttons = this.ui.roomList.querySelectorAll<HTMLButtonElement>('button')

    for (const button of buttons) {
      button.classList.toggle(
        'active',
        button.textContent === this.activeRoom?.name && this.activeRoom?.id === roomId,
      )
    }
  }

  private rebuildRoom(room: RoomDefinition): void {
    this.roomRoot.clear()

    if (this.floorGrid) {
      this.roomRoot.remove(this.floorGrid)
      this.floorGrid.geometry.dispose()
      const material = this.floorGrid.material

      if (Array.isArray(material)) {
        for (const entry of material) {
          entry.dispose()
        }
      } else {
        material.dispose()
      }
    }

    this.scene.background = new THREE.Color(room.palette.background)
    this.scene.fog = new THREE.Fog(room.palette.fog, 14, 72)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(room.bounds.width, room.bounds.depth),
      new THREE.MeshStandardMaterial({
        color: room.palette.floor,
        roughness: 0.95,
        metalness: 0.04,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.roomRoot.add(floor)

    const boundaryMaterial = new THREE.MeshStandardMaterial({
      color: room.palette.surface,
      roughness: 0.85,
    })
    const halfWidth = room.bounds.width / 2
    const halfDepth = room.bounds.depth / 2
    const wallHeight = 2
    const wallThickness = 0.6

    const northWall = new THREE.Mesh(
      new THREE.BoxGeometry(room.bounds.width, wallHeight, wallThickness),
      boundaryMaterial,
    )
    northWall.position.set(0, wallHeight / 2, -halfDepth)

    const southWall = new THREE.Mesh(
      new THREE.BoxGeometry(room.bounds.width, wallHeight, wallThickness),
      boundaryMaterial,
    )
    southWall.position.set(0, wallHeight / 2, halfDepth)

    const westWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, room.bounds.depth),
      boundaryMaterial,
    )
    westWall.position.set(-halfWidth, wallHeight / 2, 0)

    const eastWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, room.bounds.depth),
      boundaryMaterial,
    )
    eastWall.position.set(halfWidth, wallHeight / 2, 0)

    for (const wall of [northWall, southWall, westWall, eastWall]) {
      wall.castShadow = true
      wall.receiveShadow = true
      this.roomRoot.add(wall)
    }

    this.floorGrid = new THREE.GridHelper(
      Math.max(room.bounds.width, room.bounds.depth),
      Math.max(10, Math.round(Math.max(room.bounds.width, room.bounds.depth) / 2)),
      room.palette.accent,
      room.palette.surface,
    )
    this.floorGrid.position.y = 0.02
    this.roomRoot.add(this.floorGrid)

    const spawnPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: room.palette.accent,
        emissive: room.palette.emissive,
        emissiveIntensity: 0.3,
      }),
    )
    spawnPad.position.set(room.spawn.x, 0.06, room.spawn.z)
    spawnPad.receiveShadow = true
    this.roomRoot.add(spawnPad)

    for (const prop of room.props) {
      let mesh: THREE.Mesh

      if (prop.kind === 'pillar') {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(prop.size.x / 2, prop.size.z / 2, prop.size.y, 18),
          new THREE.MeshStandardMaterial({
            color: prop.color ?? room.palette.surface,
            emissive: prop.emissive ?? room.palette.emissive,
            emissiveIntensity: 0.12,
            roughness: 0.7,
          }),
        )
      } else if (prop.kind === 'pad') {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(prop.size.x, prop.size.y, prop.size.z),
          new THREE.MeshStandardMaterial({
            color: prop.color ?? room.palette.accent,
            emissive: prop.emissive ?? room.palette.emissive,
            emissiveIntensity: 0.24,
            roughness: 0.55,
          }),
        )
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(prop.size.x, prop.size.y, prop.size.z),
          new THREE.MeshStandardMaterial({
            color: prop.color ?? room.palette.surface,
            roughness: 0.82,
          }),
        )
      }

      mesh.position.set(prop.position.x, prop.position.y + prop.size.y / 2, prop.position.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.roomRoot.add(mesh)
    }

    this.directionLight.color.set(room.palette.accent)
  }

  private rebuildOccupants(occupants: OccupantDefinition[]): void {
    this.occupantRoot.clear()
    this.occupantVisuals = []
    this.ui.occupantList.replaceChildren()

    for (const [index, occupant] of occupants.entries()) {
      const listItem = document.createElement('li')
      listItem.className = 'occupant-chip'

      const swatch = document.createElement('span')
      swatch.className = 'occupant-swatch'
      swatch.style.background = occupant.color

      const label = document.createElement('span')
      label.textContent = occupant.displayName

      listItem.append(swatch, label)
      this.ui.occupantList.appendChild(listItem)

      const root = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.4, 1.05, 16),
        new THREE.MeshStandardMaterial({
          color: occupant.color,
          roughness: 0.6,
        }),
      )
      body.position.y = 0.58
      body.castShadow = true
      body.receiveShadow = true

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 18, 14),
        new THREE.MeshStandardMaterial({ color: '#f5efe7', roughness: 0.9 }),
      )
      head.position.y = 1.34
      head.castShadow = true
      head.receiveShadow = true

      const labelSprite = this.createNameLabel(occupant.displayName, occupant.color)
      labelSprite.position.set(0, 1.95, 0)

      root.position.set(occupant.position.x, 0, occupant.position.z)
      root.add(body)
      root.add(head)
      root.add(labelSprite)
      this.occupantRoot.add(root)

      this.occupantVisuals.push({
        root,
        baseY: root.position.y,
        phase: index * 0.85,
      })
    }
  }

  private createNameLabel(name: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 80

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('2D canvas context is unavailable.')
    }

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgba(5, 12, 18, 0.82)'
    this.drawRoundedRect(context, 8, 10, canvas.width - 16, canvas.height - 20, 14)
    context.fillStyle = color
    context.fillRect(16, 18, 10, canvas.height - 36)
    context.fillStyle = '#f0f6fc'
    context.font = '24px system-ui, sans-serif'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(name, 40, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    )
    sprite.scale.set(2.8, 0.88, 1)
    return sprite
  }

  private drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
    context.fill()
  }

  private positionPlayerAtSpawn(room: RoomDefinition): void {
    this.playerYaw.position.set(room.spawn.x, EYE_HEIGHT + room.spawn.y, room.spawn.z)
    this.playerYaw.rotation.y = Math.PI
    this.playerPitch.rotation.x = 0
    this.verticalVelocity = 0
    this.grounded = true
  }

  private setSessionState(text: string): void {
    this.ui.sessionState.textContent = text
  }

  private animate(): void {
    window.requestAnimationFrame(() => this.animate())
    const delta = Math.min(this.clock.getDelta(), MAX_DELTA)

    this.updatePlayer(delta)
    this.animateOccupants()
    this.renderer.render(this.scene, this.camera)
  }

  private updatePlayer(delta: number): void {
    if (!this.activeRoom) {
      return
    }

    const forwardInput = Number(this.pressedKeys.has('KeyW')) - Number(this.pressedKeys.has('KeyS'))
    const strafeInput = Number(this.pressedKeys.has('KeyD')) - Number(this.pressedKeys.has('KeyA'))
    const movement = new THREE.Vector3()

    if (forwardInput !== 0 || strafeInput !== 0) {
      const forward = new THREE.Vector3(
        Math.sin(this.playerYaw.rotation.y),
        0,
        -Math.cos(this.playerYaw.rotation.y),
      )
      const right = new THREE.Vector3(
        Math.cos(this.playerYaw.rotation.y),
        0,
        Math.sin(this.playerYaw.rotation.y),
      )

      movement.addScaledVector(forward, forwardInput)
      movement.addScaledVector(right, strafeInput)
      movement.normalize()

      const speed =
        this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight')
          ? RUN_SPEED
          : WALK_SPEED

      this.playerYaw.position.addScaledVector(movement, speed * delta)
    }

    if (this.grounded && this.pressedKeys.has('Space')) {
      this.verticalVelocity = JUMP_SPEED
      this.grounded = false
    }

    this.verticalVelocity -= GRAVITY * delta
    this.playerYaw.position.y += this.verticalVelocity * delta

    if (this.playerYaw.position.y <= EYE_HEIGHT) {
      this.playerYaw.position.y = EYE_HEIGHT
      this.verticalVelocity = 0
      this.grounded = true
    }

    const maxX = this.activeRoom.bounds.width / 2 - 1
    const maxZ = this.activeRoom.bounds.depth / 2 - 1
    this.playerYaw.position.x = THREE.MathUtils.clamp(this.playerYaw.position.x, -maxX, maxX)
    this.playerYaw.position.z = THREE.MathUtils.clamp(this.playerYaw.position.z, -maxZ, maxZ)
  }

  private animateOccupants(): void {
    const time = performance.now() * 0.001

    for (const occupant of this.occupantVisuals) {
      occupant.root.position.y = occupant.baseY + Math.sin(time * 1.6 + occupant.phase) * 0.05
      occupant.root.rotation.y = time * 0.25 + occupant.phase
    }
  }
}
