# Socket Event Diagram - Queue Cure '26

## Architecture Overview
┌─────────────────────────────────────────────────────────────┐
│ │
│ RECEPTIONIST SCREEN │
│ (index.html) │
│ │
│ 📋 Add Patient 📞 Call Next Token │
│ ⬇️ Send to Bottom ↩️ Undo Last Call │
│ 🔊 Recall Token ⏸️ Toggle Break │
│ 🔒 Change Password ✏️ Edit Name │
│ │
└───────────────────────┬─────────────────────────────────────┘
│
│ 🔌 Socket.io WebSocket
│ (Real-time Communication)
│
▼
┌─────────────────────────────────────────────────────────────┐
│ │
│ 🖥️ NODE.JS SERVER │
│ (server.js) │
│ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ QUEUE STATE │ │
│ │ 📌 activeToken (Current patient) │ │
│ │ 📋 queue[] (Waiting patients) │ │
│ │ ⏱️ avgConsultTimeMins (Smart ETA) │ │
│ │ 👥 patientsSeen (Consultation count) │ │
│ │ ⏸️ isDoctorOnBreak (Break status) │ │
│ └─────────────────────────────────────────────────┘ │
│ │
└───────────────────────┬─────────────────────────────────────┘
│
│ 🔌 Socket.io WebSocket
│ (Real-time Communication)
│
▼
┌─────────────────────────────────────────────────────────────┐
│ │
│ PATIENT WAITING ROOM │
│ (waiting-room.html) │
│ │
│ 🔢 Current Token Being Consulted │
│ 👥 Tokens Ahead Count │
│ ⏱️ Estimated Wait Time (Smart ETA) │
│ 🔊 Voice Announcements │
│ 📋 Upcoming Tokens List │
│ │
└─────────────────────────────────────────────────────────────┘


---

## Client → Server Events

### Receptionist Screen (index.html)

| Event Name | Payload | Description |
|------------|---------|-------------|
| `login` | `{ password, name }` | Authenticate user with password |
| `add_patient` | `{ name, phone, isEmergency }` | Add patient to queue |
| `call_next` | `{}` | Move next patient to consulting |
| `skip_current` | `{}` | Send current patient to bottom |
| `undo_last_call` | `{}` | Revert last called patient |
| `recall_token` | `{}` | Re-announce current token |
| `toggle_break` | `{}` | Toggle doctor break on/off |
| `update_config` | `{ avgTime }` | Change average consultation time |
| `update_name` | `{ name }` | Update receptionist name |
| `change_password` | `{ currentPassword, newPassword }` | Change system password |
| `delete_patient` | `{ tokenNumber }` | Remove specific patient |
| `clear_queue` | `{}` | Clear entire queue |

---

## Server → Client Events

### Both Screens (Receptionist + Patient Display)

| Event Name | Payload | Description |
|------------|---------|-------------|
| `queue_updated` | `{ activeToken, queue, avgConsultTimeMins, isDoctorOnBreak, patientsSeen, totalPatients }` | Full state sync - updates everything |
| `recall_trigger` | `{ tokenNumber, name }` | Trigger voice announcement |
| `error_msg` | `{ message }` | Show error notification |

### Receptionist Screen Only

| Event Name | Payload | Description |
|------------|---------|-------------|
| `login_success` | `{ name }` | Login successful |
| `login_error` | `{ message }` | Login failed |
| `force_logout` | `{ message }` | Session terminated by another device |
| `password_changed` | `{ message }` | Password updated successfully |
| `password_error` | `{ message }` | Password update failed |
| `undo_success` | `{ message }` | Undo completed |
| `undo_error` | `{ message }` | Undo failed |
| `name_updated` | `{ name }` | Name change confirmed |

---

## Sequence Diagram: Call Next Token

Receptionist Server Patient Display
│ │ │
│───call_next──────────>│ │
│ │ │
│ │ 1. Remove first patient │
│ │ from queue │
│ │ 2. Set as activeToken │
│ │ 3. Calculate avg time │
│ │ │
│ │───queue_updated────────>│
│ │ │
│ │───recall_trigger───────>│
│ │ │
│<───queue_updated──────│ │
│ │ │
│ (UI updates) │ │ (Voice plays)
│ │ │ (UI updates)


---

## Sequence Diagram: Undo Last Call


Receptionist Server Patient Display
│ │ │
│───undo_last_call─────>│ │
│ │ │
│ │ 1. Get lastCalledPatient│
│ │ 2. If activeToken exists│
│ │ put back in queue │
│ │ 3. Restore last patient │
│ │ │
│ │───queue_updated────────>│
│ │ │
│<───undo_success───────│ │
│ │ │
│ (Patient restored) │ │ (UI updates)


---

## Sequence Diagram: Add Patient with Emergency

Receptionist Server Patient Display
│ │ │
│───add_patient────────>│ │
│ {name, phone, │ │
│ isEmergency: true} │ │
│ │ │
│ │ 1. Check duplicates │
│ │ 2. Find emergency index │
│ │ 3. Insert after other │
│ │ emergency patients │
│ │ │
│ │───queue_updated────────>│
│ │ │
│<───queue_updated──────│ │
│ │ │
│ (Patient added) │ │ (UI updates)


---

## State Management

### Server State Object

```javascript
{
  activeToken: {
    tokenNumber: 23,
    name: "Ravi Kumar",
    phone: "9876543210",
    isEmergency: false,
    timestamp: 1700000000000
  },
  queue: [
    { tokenNumber: 24, name: "Priya Singh", isEmergency: false },
    { tokenNumber: 25, name: "Arjun Mehta", isEmergency: false },
    { tokenNumber: 26, name: "Neha Patel", isEmergency: true }
  ],
  avgConsultTimeMins: 6,
  isDoctorOnBreak: false,
  patientsSeen: 22,
  totalPatients: 48,
  receptionistName: "Anita Reddy"
}


┌──────────────────────────────────────────────────────────────────┐
│                       ERROR SCENARIOS                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ❌ Empty Queue on call_next                                    │
│     └── activeToken = null                                      │
│     └── Show "Waiting for next patient..."                      │
│                                                                  │
│  ❌ Duplicate Patient                                           │
│     └── Check name AND phone                                    │
│     └── error_msg → "Patient already in queue!"                 │
│                                                                  │
│  ❌ Network Disconnect                                          │
│     └── Offline banner appears                                  │
│     └── Auto-reconnect on socket.io                            │
│                                                                  │
│  ❌ Multiple Logins                                             │
│     └── Track activeSessions                                   │
│     └── force_logout → "Logged in from another device"          │
│                                                                  │
│  ❌ Wrong Password                                              │
│     └── login_error → "Incorrect password"                     │
│                                                                  │
│  ❌ Doctor Break                                                │
│     └── isDoctorOnBreak = true                                 │
│     └── Disable "Call Next" button                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

// Prevent double clicks
let isProcessingCall = false;

socket.on('call_next', () => {
    if (isProcessingCall) return;  // 🔒 Lock check
    isProcessingCall = true;       // 🔒 Acquire lock
    
    // ... process the call ...
    
    isProcessingCall = false;      // 🔓 Release lock
});

// Prevent multiple sessions
let activeSessions = {};

// On login, check if user already exists
const existingSession = Object.keys(activeSessions).find(
    id => activeSessions[id].name === data.name
);
if (existingSession) {
    // 🚫 Force logout old session
    io.to(existingSession).emit('force_logout');
    delete activeSessions[existingSession];
}

┌─────────────────────────────────────────────────────────────┐
│                     config.json                            │
├─────────────────────────────────────────────────────────────┤
│  {                                                         │
│    "password": "AG1234",                                 │
│    "receptionistName": "Anita Reddy"                       │
│  }                                                         │
└─────────────────────────────────────────────────────────────┘

Note: Queue state is NOT persisted
(better for privacy, resets on server restart)
