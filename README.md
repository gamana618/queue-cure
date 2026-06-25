# Queue Cure '26

**Smart Queue. Happy You.** 🏥

A real-time queue management system for clinics that eliminates paper slips and shouting.

## 🎯 The Problem

76% of India's 1.5 million clinics still run on paper token slips and shouting. Patients wait 2-3 hours with zero visibility. Doctors have no dashboard. Receptionists manage everything from memory.

**Queue Cure '26 fixes this.**

---

## ✨ Features

### 🔄 Real-time Sync
Both screens update instantly when "Call Next" is clicked. No refresh needed!

### ⏱️ Smart ETA
Wait time calculated from actual consultation data - not hardcoded!

### 🚨 Emergency Priority
Urgent patients automatically jump ahead of the queue.

### 🔊 Voice Announcements
Automatic voice calls out patient name and token number on the waiting room screen.

### ↩️ Mistake-Proof
- **Undo Last Call** - Accidentally called someone? Undo it!
- **Send to Bottom** - Patient didn't arrive? Send them to the back.
- **Confirm Dialogs** - Destructive actions need confirmation.

### 🔐 Secure
- Password protected login
- Single session per user (prevents multiple logins)
- Change password anytime

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | Backend server |
| **Socket.io** | Real-time WebSocket communication |
| **Vanilla JS + CSS** | Frontend with Glassmorphism design |
| **JSON File** | Lightweight data persistence |

---

## 🚀 Quick Start

### Prerequisites
- Node.js installed on your system

### Installation

```bash
# Clone the repository
git clone https://github.com/gaman618/queue-cure.git
cd queue-cure

# Install dependencies
npm install

# Start the server
node server.js


🔗 Live Demo Links
Local Development (Run on your machine)
Screen	URL	Description
Receptionist Dashboard	http://localhost:3000	Manage patients and queue
Patient Waiting Room	http://localhost:3000/waiting-room.html	Display for patients


Login Credentials
Field	Value
Default Password admin123
Alternative Password	AG1234
Receptionist Name	Aruna (editable)
Note: If the password doesn't work, check your config.json file to see what password is stored.



// Estimate wait for each patient
estimatedWait = queue.length × avgConsultTime
