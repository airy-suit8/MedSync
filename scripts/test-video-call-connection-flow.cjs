const assert = require('assert')

function shouldCurrentUserActAsHost(userRole, meeting, userId) {
  if (userRole === 'doctor') return true
  if (!meeting || !userId) return false
  return meeting.host_id === userId
}

class MockPeerConnection {
  constructor(ownerName) {
    this.ownerName = ownerName
    this.localDescription = null
    this.remoteDescription = null
    this.currentRemoteDescription = null
    this.addedIceCandidates = []
  }

  async createOffer() {
    return {
      type: 'offer',
      sdp: `offer-sdp-${this.ownerName}-${Date.now()}`
    }
  }

  async createAnswer() {
    return {
      type: 'answer',
      sdp: `answer-sdp-${this.ownerName}-${Date.now()}`
    }
  }

  async setLocalDescription(description) {
    this.localDescription = description
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description
    this.currentRemoteDescription = description
  }

  async addIceCandidate(candidate) {
    this.addedIceCandidates.push(candidate)
  }
}

class SignalingBus {
  constructor() {
    this.participants = []
  }

  register(participant) {
    this.participants.push(participant)
    participant.bus = this
  }

  async broadcast(sender, payload) {
    for (const participant of this.participants) {
      if (participant === sender) continue
      await participant.handleIncomingSignal({
        ...payload,
        fromUserId: sender.userId,
        senderName: sender.name
      })
    }
  }
}

class Participant {
  constructor({ name, userRole, userId, meeting }) {
    this.name = name
    this.userRole = userRole
    this.userId = userId
    this.meeting = meeting
    this.bus = null

    this.isConnected = false
    this.isHost = false
    this.isCreatingOffer = false

    this.peerConnection = null
    this.pendingIceCandidates = []
  }

  async createPeerConnection() {
    if (this.peerConnection) return this.peerConnection
    this.peerConnection = new MockPeerConnection(this.name)
    return this.peerConnection
  }

  async sendSignal(payload) {
    if (!this.bus) throw new Error(`${this.name} is not attached to signaling bus`)
    await this.bus.broadcast(this, payload)
  }

  async flushPendingIceCandidates(peerConnection) {
    if (!peerConnection.remoteDescription) return
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift()
      await peerConnection.addIceCandidate(candidate)
    }
  }

  async createAndSendOffer() {
    if (!this.isHost || !this.isConnected || this.isCreatingOffer) return

    this.isCreatingOffer = true
    try {
      const peerConnection = await this.createPeerConnection()
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      await this.sendSignal({
        type: 'offer',
        description: offer
      })
    } finally {
      this.isCreatingOffer = false
    }
  }

  async joinOrStartMeeting() {
    this.isHost = shouldCurrentUserActAsHost(this.userRole, this.meeting, this.userId)
    this.isConnected = true

    await this.sendSignal({ type: 'ready' })
    if (this.isHost) {
      await this.createAndSendOffer()
    }
  }

  async handleIncomingSignal(payload) {
    if (!payload || payload.fromUserId === this.userId) return

    if (payload.type === 'ready') {
      if (this.isHost && this.isConnected) {
        await this.createAndSendOffer()
      }
      return
    }

    if (payload.type === 'hangup') {
      this.peerConnection = null
      return
    }

    if (!this.isConnected) {
      return
    }

    if (payload.type === 'offer' && payload.description) {
      const peerConnection = await this.createPeerConnection()
      await peerConnection.setRemoteDescription(payload.description)
      await this.flushPendingIceCandidates(peerConnection)

      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      await this.sendSignal({
        type: 'answer',
        description: answer
      })
      return
    }

    if (payload.type === 'answer' && payload.description) {
      const peerConnection = await this.createPeerConnection()
      if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(payload.description)
        await this.flushPendingIceCandidates(peerConnection)
      }
      return
    }

    if (payload.type === 'ice-candidate' && payload.candidate) {
      const peerConnection = this.peerConnection
      if (!peerConnection) {
        this.pendingIceCandidates.push(payload.candidate)
        return
      }

      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(payload.candidate)
      } else {
        this.pendingIceCandidates.push(payload.candidate)
      }
    }
  }
}

const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

test('doctor is always host; patient host depends on meeting.host_id', async () => {
  assert.strictEqual(
    shouldCurrentUserActAsHost('doctor', { host_id: 'legacy-host-id' }, 'doctor-auth-id'),
    true
  )
  assert.strictEqual(
    shouldCurrentUserActAsHost('patient', { host_id: 'patient-auth-id' }, 'patient-auth-id'),
    true
  )
  assert.strictEqual(
    shouldCurrentUserActAsHost('patient', { host_id: 'doctor-auth-id' }, 'patient-auth-id'),
    false
  )
})

test('doctor and patient complete offer/answer handshake even if meeting host_id is legacy', async () => {
  const meeting = {
    meeting_id: 'TESTMEET001',
    host_id: 'legacy-host-id'
  }

  const bus = new SignalingBus()
  const doctor = new Participant({
    name: 'doctor',
    userRole: 'doctor',
    userId: 'doctor-auth-id',
    meeting
  })
  const patient = new Participant({
    name: 'patient',
    userRole: 'patient',
    userId: 'patient-auth-id',
    meeting
  })

  bus.register(doctor)
  bus.register(patient)

  await doctor.joinOrStartMeeting()
  await patient.joinOrStartMeeting()

  assert.strictEqual(doctor.isHost, true)
  assert.strictEqual(patient.isHost, false)
  assert.ok(doctor.peerConnection, 'doctor should have peer connection')
  assert.ok(patient.peerConnection, 'patient should have peer connection')
  assert.strictEqual(doctor.peerConnection.localDescription?.type, 'offer')
  assert.strictEqual(patient.peerConnection.remoteDescription?.type, 'offer')
  assert.strictEqual(patient.peerConnection.localDescription?.type, 'answer')
  assert.strictEqual(doctor.peerConnection.remoteDescription?.type, 'answer')
})

test('ICE candidate is queued before peer connection exists and flushed after remote description', async () => {
  const meeting = {
    meeting_id: 'TESTMEET002',
    host_id: 'doctor-auth-id'
  }

  const bus = new SignalingBus()
  const doctor = new Participant({
    name: 'doctor',
    userRole: 'doctor',
    userId: 'doctor-auth-id',
    meeting
  })
  const patient = new Participant({
    name: 'patient',
    userRole: 'patient',
    userId: 'patient-auth-id',
    meeting
  })

  bus.register(doctor)
  bus.register(patient)

  doctor.isConnected = true
  doctor.isHost = true
  patient.isConnected = true

  const earlyCandidate = { candidate: 'candidate:1 1 UDP 2122252543 10.0.0.1 8998 typ host' }
  await doctor.sendSignal({
    type: 'ice-candidate',
    candidate: earlyCandidate
  })

  assert.strictEqual(patient.pendingIceCandidates.length, 1)

  const offerDescription = {
    type: 'offer',
    sdp: 'offer-sdp-manual'
  }
  await doctor.sendSignal({
    type: 'offer',
    description: offerDescription
  })

  assert.ok(patient.peerConnection, 'patient peer connection should be created when offer arrives')
  assert.strictEqual(patient.pendingIceCandidates.length, 0)
  assert.strictEqual(patient.peerConnection.addedIceCandidates.length, 1)
  assert.deepStrictEqual(patient.peerConnection.addedIceCandidates[0], earlyCandidate)
})

test('non-host participant cannot generate offer proactively', async () => {
  const participant = new Participant({
    name: 'patient',
    userRole: 'patient',
    userId: 'patient-auth-id',
    meeting: {
      meeting_id: 'TESTMEET003',
      host_id: 'doctor-auth-id'
    }
  })

  participant.isConnected = true
  participant.isHost = false
  participant.bus = { broadcast: async () => {} }

  await participant.createAndSendOffer()
  assert.strictEqual(participant.peerConnection, null)
})

async function run() {
  let passed = 0

  for (const { name, fn } of tests) {
    try {
      await fn()
      passed += 1
      console.log(`✅ ${name}`)
    } catch (error) {
      console.error(`❌ ${name}`)
      console.error(error && error.stack ? error.stack : error)
      process.exitCode = 1
    }
  }

  console.log(`\n${passed}/${tests.length} video call flow checks passed`)
  if (passed !== tests.length) {
    process.exit(1)
  }
}

run().catch(error => {
  console.error('❌ Test runner failed unexpectedly')
  console.error(error && error.stack ? error.stack : error)
  process.exit(1)
})
