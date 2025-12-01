// State
let currentSessionId = null;

// DOM Elements
const views = {
    list: document.getElementById('view-list'),
    create: document.getElementById('view-create'),
    details: document.getElementById('view-details')
};

// API Configuration
const BACKEND_HOST = window.location.hostname + ':3000';
const isSecure = window.location.protocol === 'https:';
const httpProtocol = isSecure ? 'https:' : 'http:';
const wsProtocol = isSecure ? 'wss:' : 'ws:';

const API_BASE = `${httpProtocol}//${BACKEND_HOST}/sessions`;
const WS_URL = `${wsProtocol}//${BACKEND_HOST}/ws`;

// Websocket Setup
let ws;
function setupWebsocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Connected to WebSocket');
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('WS Message:', message);

            if (message.type === 'sessionUpdate') {
                if (!views.list.classList.contains('hidden')) {
                    listSessions();
                }
                // Refresh details if viewing this session
                if (currentSessionId === message.session.name) {
                     viewSession(message.session.name);
                }
            } else if (message.type === 'activitiesUpdate') {
                 // message.sessionId (e.g. 123)
                 if (currentSessionId && currentSessionId.endsWith('/' + message.sessionId)) {
                     viewSession(currentSessionId);
                 }
            }
        } catch (e) {
            console.error('Error handling WS message', e);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket closed, retrying in 3s...');
        setTimeout(setupWebsocket, 3000);
    };
}

setupWebsocket();

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    let url = API_BASE;
    let path = endpoint;

    if (path === 'sessions') {
        // base
    } else if (path.startsWith('sessions/')) {
        path = path.replace('sessions/', '');
        path = path.replace(':sendMessage', '/sendMessage');
        path = path.replace(':approvePlan', '/approvePlan');
        url += '/' + path;
    }

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || 'API Error');
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (err) {
        alert(`Error: ${err.message}`);
        throw err;
    }
}

// UI Functions
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
}

async function listSessions() {
    try {
        const data = await apiCall('sessions');
        const container = document.getElementById('sessions-container');
        container.innerHTML = '';

        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach(session => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.innerHTML = `
                    <div>
                        <strong>${session.name}</strong><br>
                        <small>${session.prompt ? session.prompt.substring(0, 50) + (session.prompt.length > 50 ? '...' : '') : 'No prompt'}</small>
                    </div>
                    <div>
                        <span class="session-status">${session.state || 'UNKNOWN'}</span>
                        <button onclick="viewSession('${session.name}')">View</button>
                    </div>
                `;
                container.appendChild(div);
            });
        } else {
            container.innerHTML = '<p>No sessions found.</p>';
        }
        showView('list');
    } catch (err) {
        console.error(err);
    }
}

async function createSession(e) {
    e.preventDefault();
    const prompt = document.getElementById('prompt').value;
    const source = document.getElementById('source').value;
    const branch = document.getElementById('branch').value;

    const payload = {
        prompt,
        sourceContext: {
            source,
            githubRepoContext: {
                startingBranch: branch
            }
        }
    };

    try {
        await apiCall('sessions', 'POST', payload);
        alert('Session created!');
        document.getElementById('create-session-form').reset();
        listSessions();
    } catch (err) {
        console.error(err);
    }
}

function renderActivity(activity) {
    let content = '';
    let icon = '•';

    if (activity.agentMessaged) {
        icon = 'AG';
        content = `<strong>Agent:</strong> ${activity.agentMessaged.agentMessage}`;
    } else if (activity.userMessaged) {
        icon = 'US';
        content = `<strong>User:</strong> ${activity.userMessaged.userMessage}`;
    } else if (activity.planGenerated) {
        icon = 'PL';
        content = `<strong>Plan Generated:</strong>`;
        const steps = activity.planGenerated.plan?.steps || [];
        if (steps.length > 0) {
            content += '<ul>';
            steps.forEach(step => {
                content += `<li><strong>${step.title}</strong>: ${step.description}</li>`;
            });
            content += '</ul>';
        }
    } else if (activity.planApproved) {
        icon = 'OK';
        content = `<strong>Plan Approved</strong>`;
    } else if (activity.progressUpdated) {
        icon = 'PR';
        content = `<strong>Progress:</strong> ${activity.progressUpdated.title} - ${activity.progressUpdated.description}`;
    } else if (activity.sessionCompleted) {
        icon = 'FIN';
        content = `<strong>Session Completed</strong>`;
    } else if (activity.sessionFailed) {
        icon = 'ERR';
        content = `<strong>Session Failed:</strong> ${activity.sessionFailed.reason}`;
    } else {
        content = `Unknown Activity Type: <pre>${JSON.stringify(activity, null, 2)}</pre>`;
    }

    return `
        <div class="activity-icon">${icon}</div>
        <div class="activity-content">${content}
            <div class="activity-time">${activity.createTime || ''}</div>
        </div>
    `;
}

async function viewSession(sessionName) {
    currentSessionId = sessionName;
    try {
        // Fetch session details
        const session = await apiCall(sessionName);

        document.getElementById('session-title').innerText = session.name;
        document.getElementById('session-info').innerHTML = `
            <p><strong>ID:</strong> ${session.id}</p>
            <p><strong>State:</strong> ${session.state}</p>
            <p><strong>Prompt:</strong> ${session.prompt}</p>
            <p><strong>Created:</strong> ${session.createTime}</p>
        `;

        // Fetch activities
        try {
            const activitiesData = await apiCall(`${sessionName}/activities`);
            const activitiesContainer = document.getElementById('activities-container');
            activitiesContainer.innerHTML = '';

            if (activitiesData.activities) {
                activitiesData.activities.forEach(act => {
                    const div = document.createElement('div');
                    div.className = 'activity-item';
                    div.innerHTML = renderActivity(act);
                    activitiesContainer.appendChild(div);
                });
            } else {
                activitiesContainer.innerHTML = '<p>No activities.</p>';
            }
        } catch (e) {
             console.warn("Could not fetch activities", e);
             document.getElementById('activities-container').innerHTML = '<p>Could not load activities.</p>';
        }

        showView('details');
    } catch (err) {
        console.error(err);
    }
}

async function sendMessage() {
    if (!currentSessionId) return;
    const input = document.getElementById('message-input');
    const prompt = input.value.trim();
    if (!prompt) return;

    try {
        await apiCall(`${currentSessionId}:sendMessage`, 'POST', { prompt });
        input.value = '';
        viewSession(currentSessionId);
    } catch (err) {
        console.error(err);
    }
}

async function approvePlan() {
    if (!currentSessionId) return;
    try {
        await apiCall(`${currentSessionId}:approvePlan`, 'POST', {});
        alert('Plan approved!');
        viewSession(currentSessionId);
    } catch (err) {
        console.error(err);
    }
}

// Event Listeners
document.getElementById('nav-list').addEventListener('click', listSessions);
document.getElementById('nav-create').addEventListener('click', () => showView('create'));
document.getElementById('create-session-form').addEventListener('submit', createSession);
document.getElementById('back-to-list').addEventListener('click', listSessions);
document.getElementById('send-message-btn').addEventListener('click', sendMessage);
document.getElementById('approve-plan-btn').addEventListener('click', approvePlan);

// Global
window.viewSession = viewSession;

// Initial Load
listSessions();
