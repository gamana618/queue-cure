const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

// --- CONFIG FILE FOR PERSISTENCE ---
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load or create config
let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
    config = {
        password: 'admin123',
        receptionistName: 'Anita Reddy'
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// --- DATABASE & SYSTEM STATE ---
let queue = [];
let activeToken = null;
let tokenCounter = 1;
let lastCallTime = null;
let totalConsultTime = 0;
let patientsSeen = 0;
let avgConsultTimeMins = 5;
let isDoctorOnBreak = false;
let isProcessingCall = false;
let lastCalledPatient = null;
let activeSessions = {};

function getState() {
    return {
        activeToken,
        queue,
        avgConsultTimeMins,
        isDoctorOnBreak,
        patientsSeen,
        totalPatients: tokenCounter - 1,
        receptionistName: config.receptionistName
    };
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

io.on('connection', (socket) => {
    console.log(`🟢 User connected: ${socket.id}`);
    
    socket.emit('queue_updated', getState());

    // --- AUTHENTICATION ---
    socket.on('login', (data) => {
        console.log(`Login attempt: ${data.name} with password: ${data.password}`);
        console.log(`Expected password: ${config.password}`);
        
        if (data.password === config.password) {
            const existingSession = Object.keys(activeSessions).find(
                id => activeSessions[id].name === data.name
            );
            
            if (existingSession) {
                io.to(existingSession).emit('force_logout', 'Logged in from another device');
                io.sockets.sockets.get(existingSession)?.disconnect();
                delete activeSessions[existingSession];
            }
            
            activeSessions[socket.id] = {
                name: data.name,
                loginTime: new Date().toISOString()
            };
            
            socket.emit('login_success', { 
                name: data.name,
                message: 'Login successful'
            });
            console.log(`✅ Login successful for ${data.name}`);
        } else {
            socket.emit('login_error', 'Incorrect password');
            console.log(`❌ Login failed for ${data.name}`);
        }
    });

    // --- CHANGE PASSWORD ---
    socket.on('change_password', (data) => {
        if (data.currentPassword === config.password) {
            if (data.newPassword && data.newPassword.length >= 6) {
                config.password = data.newPassword;
                saveConfig();
                socket.emit('password_changed', 'Password updated successfully');
                Object.keys(activeSessions).forEach(id => {
                    if (id !== socket.id) {
                        io.to(id).emit('force_logout', 'Password was changed by another user');
                        io.sockets.sockets.get(id)?.disconnect();
                        delete activeSessions[id];
                    }
                });
            } else {
                socket.emit('password_error', 'New password must be at least 6 characters');
            }
        } else {
            socket.emit('password_error', 'Current password is incorrect');
        }
    });

    // --- UPDATE RECEPTIONIST NAME ---
    socket.on('update_name', (data) => {
        if (data.name && data.name.trim().length >= 2) {
            config.receptionistName = data.name.trim();
            saveConfig();
            io.emit('name_updated', config.receptionistName);
        }
    });

    // --- ADD PATIENT ---
    socket.on('add_patient', (data) => {
        const isDuplicate = queue.some(p => 
            p.name.toLowerCase() === data.name.toLowerCase() || 
            (data.phone && p.phone === data.phone)
        );

        if (isDuplicate) {
            socket.emit('error_msg', `Patient "${data.name}" is already in the queue!`);
            return;
        }

        const newPatient = {
            tokenNumber: tokenCounter++,
            name: data.name,
            phone: data.phone || "N/A",
            isEmergency: data.isEmergency || false,
            timestamp: Date.now()
        };

        if (data.isEmergency) {
            const insertIndex = queue.findIndex(p => !p.isEmergency);
            if (insertIndex === -1) {
                queue.push(newPatient);
            } else {
                queue.splice(insertIndex, 0, newPatient);
            }
        } else {
            queue.push(newPatient);
        }

        io.emit('queue_updated', getState());
    });

    // --- CALL NEXT ---
    socket.on('call_next', () => {
        if (isProcessingCall || isDoctorOnBreak) return;
        isProcessingCall = true;

        const now = Date.now();
        if (lastCallTime && activeToken) {
            const timeSpentMins = (now - lastCallTime) / 60000;
            if (timeSpentMins > 0.05) {
                totalConsultTime += timeSpentMins;
                patientsSeen++;
                avgConsultTimeMins = Math.max(1, Math.round(totalConsultTime / patientsSeen));
            }
        }

        lastCalledPatient = activeToken ? { ...activeToken } : null;
        lastCallTime = now;
        activeToken = queue.length > 0 ? queue.shift() : null;

        io.emit('queue_updated', getState());
        
        if (activeToken) {
            io.emit('recall_trigger', activeToken);
        }
        
        isProcessingCall = false;
    });

    // --- UNDO LAST CALL ---
    socket.on('undo_last_call', () => {
        if (lastCalledPatient && !activeToken) {
            activeToken = lastCalledPatient;
            lastCalledPatient = null;
            io.emit('queue_updated', getState());
            socket.emit('undo_success', 'Last call undone');
        } else if (lastCalledPatient && activeToken) {
            queue.unshift(activeToken);
            activeToken = lastCalledPatient;
            lastCalledPatient = null;
            io.emit('queue_updated', getState());
            socket.emit('undo_success', 'Last call undone');
        } else {
            socket.emit('undo_error', 'No previous call to undo');
        }
    });

    // --- RECALL TOKEN ---
    socket.on('recall_token', () => {
        if (activeToken) {
            io.emit('recall_trigger', activeToken);
        }
    });

    // --- TOGGLE BREAK ---
    socket.on('toggle_break', () => {
        isDoctorOnBreak = !isDoctorOnBreak;
        io.emit('queue_updated', getState());
    });

    // --- UPDATE CONFIG ---
    socket.on('update_config', (newAvgTime) => {
        const parsedTime = parseInt(newAvgTime);
        if (!isNaN(parsedTime) && parsedTime > 0) {
            avgConsultTimeMins = parsedTime;
            io.emit('queue_updated', getState());
        }
    });

    // --- SKIP / SEND TO BOTTOM ---
    socket.on('skip_current', () => {
        if (activeToken) {
            activeToken.isEmergency = false;
            queue.push(activeToken);
            activeToken = queue.length > 0 ? queue.shift() : null;
            lastCallTime = Date.now();
            io.emit('queue_updated', getState());
            
            if (activeToken) {
                io.emit('recall_trigger', activeToken);
            }
        }
    });

    // --- DELETE PATIENT ---
    socket.on('delete_patient', (targetToken) => {
        queue = queue.filter(patient => patient.tokenNumber !== targetToken);
        io.emit('queue_updated', getState());
    });

    // --- CLEAR QUEUE ---
    socket.on('clear_queue', () => {
        queue = [];
        activeToken = null;
        lastCallTime = null;
        lastCalledPatient = null;
        io.emit('queue_updated', getState());
    });

    socket.on('disconnect', () => {
        console.log(`🔴 User disconnected: ${socket.id}`);
        delete activeSessions[socket.id];
    });
});

// --- START SERVER ---
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Queue Cure Server running on http://localhost:${PORT}`);
    
    // Auto-open browser
    try {
        const start = (process.platform === 'darwin' ? 'open' : 
                       process.platform === 'win32' ? 'start' : 'xdg-open');
        require('child_process').exec(`${start} http://localhost:${PORT}`);
    } catch(e) {
        // Ignore if browser can't open automatically
    }
});
