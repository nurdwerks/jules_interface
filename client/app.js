// client/app.js

let sessions = [];
let currentSessionId = null; // Stores session name (e.g. sessions/123)
let currentSubscribedSessionId = null; // Stores session ID (e.g. 123)
let sources = [];

// WebSocket
let ws;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws`;

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

async function checkAuth() {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
        showLogin();
    } else {
        initApp(token);
    }
}

function showLogin() {
    const modal = document.getElementById('login-modal');
    modal.classList.remove('hidden');

    document.getElementById('login-btn').addEventListener('click', async () => {
        const u = document.getElementById('username-input').value;
        const p = document.getElementById('password-input').value;
        if(u && p) {
            // WS Auth
            connectWS(u, p);
        }
    });
}

function initApp(token) {
    document.getElementById('login-modal').classList.add('hidden');
    // If token exists, we assume we can connect or we might need to validate.
    // Ideally we re-use token but for this simple app we might just reconnect with stored creds
    // or rely on the fact that we need to send creds again?
    // The instructions say "Authentication over WebSockets...".
    // If we have a token, maybe we pass it?
    // For now, let's assume we need to login again if page refresh, or use stored creds if we had them?
    // Let's just rely on the user logging in for now if token logic isn't fully spec'd.
    // Actually, let's just trigger connectWS if we have "stored" credentials?
    // The prompt implementation just showed the login modal.
    // Let's keep it simple: if valid token, maybe just connect?
    // But connectWS takes user/pass.
    // Let's just show login if not connected.
}

function connectWS(username, password) {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', username, password }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'authSuccess') {
            localStorage.setItem('sessionToken', msg.sessionToken);
            document.getElementById('login-modal').classList.add('hidden');
            // Initial Data might come
        } else if (msg.type === 'authError') {
             document.getElementById('login-error').innerText = "Auth Failed";
        } else if (msg.type === 'initialData') {
            sessions = msg.sessions || [];
            sources = msg.sources || [];
            renderSessions();
            loadSources();
        } else if (msg.type === 'sessionUpdate') {
             const idx = sessions.findIndex(s => s.id === msg.session.id);
             if (idx !== -1) {
                 sessions[idx] = msg.session;
             } else {
                 sessions.unshift(msg.session);
             }
             renderSessions();
             if (currentSessionId === msg.session.name) {
                 // Update details view header/info if viewing this session
                 const titleEl = document.getElementById('session-title');
                 if(titleEl) titleEl.innerText = msg.session.prompt || msg.session.name;
                 const infoEl = document.getElementById('session-info');
                 if(infoEl) {
                     infoEl.innerHTML = `
                        <p><strong>ID:</strong> ${msg.session.id}</p>
                        <p><strong>State:</strong> <span class="${getStatusInfo(msg.session.state).class}" style="display:inline-block;width:8px;height:8px;border-radius:50%"></span> ${msg.session.state}</p>
                        <p><strong>Prompt:</strong> ${msg.session.prompt}</p>
                    `;
                 }
             }
        } else if (msg.type === 'activitiesUpdate') {
             // Check if this update belongs to the current session being viewed
             // We need to match msg.sessionId with currentSessionId (which is name)
             // We can look up the session in our sessions list
             const session = sessions.find(s => s.id === msg.sessionId);
             if (session && session.name === currentSessionId) {
                 renderActivities(msg.activities);
             }
        }
    };

    ws.onclose = () => {
        // Reconnect logic or show error
        console.log("WS Closed");
    };
}

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
    };
    // The backend uses Authorization header for REST.
    // We need to attach the token.

    // Note: The backend instructions say "protects API routes... requiring an Authorization header".
    // The header value should likely be "Bearer <token>" or just the token?
    // Let's assume just the token or "Bearer " + token.
    // The auth plugin checks `request.headers.authorization`.

    const res = await fetch(`/${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    if (res.status === 401) {
        localStorage.removeItem('sessionToken');
        showLogin();
        throw new Error("Unauthorized");
    }

    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// UI Functions

function showView(viewName) {
    if (viewName !== 'details') {
        updateSubscription(null);
    }
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
}

function listSessions() {
    // Determine active filters
    // Fetch if needed, but we have `sessions` from WS or we can fetch.
    // Let's fetch to be sure
    apiCall('sessions').then(data => {
        sessions = data.sessions || [];
        renderSessions();
    }).catch(e => console.error(e));
}

function renderSessions() {
    const list = document.getElementById('session-list-sidebar');
    if (!list) return;
    list.innerHTML = '';

    // Filter Logic
    const filterSource = document.getElementById('filter-source');
    const selectedSource = filterSource ? filterSource.value : 'ALL';

    const filterRecent = document.getElementById('filter-recent');
    const recentOnly = filterRecent ? filterRecent.checked : false;

    // Filter and Sort
    let displaySessions = sessions.filter(session => {
        // Source Filter
        if (selectedSource !== 'ALL') {
            const sessionSource = session.sourceContext?.source;
            if (sessionSource !== selectedSource) return false;
        }

        // Recent Filter (24h)
        if (recentOnly) {
             const updateTime = new Date(session.updateTime || session.createTime); // Fallback to createTime if updateTime missing
             const now = new Date();
             const diffMs = now - updateTime;
             const diffHours = diffMs / (1000 * 60 * 60);
             if (diffHours > 24) return false;
        }

        return true;
    });

    // Sort by updateTime (newest first)
    displaySessions.sort((a, b) => {
        const tA = new Date(a.updateTime || a.createTime).getTime();
        const tB = new Date(b.updateTime || b.createTime).getTime();
        return tB - tA;
    });

    displaySessions.forEach(session => {
        const div = document.createElement('div');
        div.className = 'session-item';
        if (currentSessionId === session.name) div.classList.add('active');

        // Status Dot
        const statusInfo = getStatusInfo(session.state);
        const dot = document.createElement('span');
        dot.style.display = 'inline-block';
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.marginRight = '8px';
        dot.className = statusInfo.class; // e.g. status-queue
        dot.style.backgroundColor = 'currentColor'; // uses text color from class

        div.appendChild(dot);

        const span = document.createElement('span');
        span.innerText = session.prompt || session.name; // Use prompt as title per screenshot
        span.style.overflow = 'hidden';
        span.style.textOverflow = 'ellipsis';
        div.appendChild(span);

        div.addEventListener('click', () => viewSession(session.name));
        list.appendChild(div);
    });
}

function getStatusInfo(state) {
    switch (state) {
        case 'QUEUED': return { class: 'status-queue', color: 'blue' };
        case 'RUNNING': return { class: 'status-active', color: 'yellow' };
        case 'COMPLETED': return { class: 'status-done', color: 'green' };
        case 'FAILED': return { class: 'status-fail', color: 'red' };
        default: return { class: '', color: 'gray' };
    }
}

function loadSources() {
    // Populate source select
    const select = document.getElementById('source');
    if(!select) return;
    select.innerHTML = '';
    // If sources empty, fetch?
    if (sources.length === 0) {
        apiCall('sources').then(data => {
            sources = data.sources || [];
            populateSources();
        }).catch(e => console.error(e));
    } else {
        populateSources();
    }
}

function populateSources() {
    // Populate Create Form source
    const select = document.getElementById('source');
    if(select) {
        select.innerHTML = '';
        sources.forEach(src => {
            const opt = document.createElement('option');
            opt.value = src.name;
            opt.innerText = src.name;
            select.appendChild(opt);
        });
    }

    // Populate Filter Source
    const filterSelect = document.getElementById('filter-source');
    if(filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="ALL">All Sources</option>';
        sources.forEach(src => {
            const opt = document.createElement('option');
            opt.value = src.name;
            opt.innerText = src.name;
            filterSelect.appendChild(opt);
        });
        // Restore value if possible
        if(currentVal && currentVal !== 'ALL' && sources.find(s => s.name === currentVal)) {
            filterSelect.value = currentVal;
        }
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
        showView('list'); // or stay on create
    } catch (err) {
        console.error(err);
    }
}

function renderActivity(activity) {
    let content = '';

    // Determine if User or Agent
    let isAgent = true;
    if (activity.userMessaged) {
        isAgent = false;
        content = activity.userMessaged.userMessage;
    } else if (activity.agentMessaged) {
        content = marked.parse(activity.agentMessaged.agentMessage);
    } else if (activity.planGenerated) {
        content = `<strong>Plan Generated:</strong>`;
        const steps = activity.planGenerated.plan?.steps || [];
        if (steps.length > 0) {
            content += '<div class="plan-card">';
            steps.forEach(step => {
                content += `<div class="plan-step"><strong>${step.title}</strong><br><span style="font-size:0.9em;color:#aaa">${step.description}</span></div>`;
            });
            content += '</div>';
        }
        // Add Approve Button with class
        content += `<div style="margin-top:10px;"><button class="primary-btn approve-plan-button">Approve Plan</button></div>`;
    } else if (activity.planApproved) {
        content = `<em>Plan Approved</em>`;
        // Treat as system/user action? Let's say user.
        isAgent = false;
    } else if (activity.progressUpdated) {
        content = `<strong>Progress:</strong> ${activity.progressUpdated.title}`;
    } else if (activity.sessionCompleted) {
        content = `<strong>Session Completed</strong>`;
    } else if (activity.sessionFailed) {
        content = `<strong style="color: var(--accent-error)">Session Failed:</strong> ${activity.sessionFailed.reason}`;
    } else {
        content = `<pre>${JSON.stringify(activity, null, 2)}</pre>`;
    }

    const typeClass = isAgent ? 'agent' : 'user';
    const time = activity.createTime ? new Date(activity.createTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

    // Encode activity data for the modal
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(activity))));

    return `
        <div class="activity-item ${typeClass}">
            <div class="chat-bubble">
                ${content}
            </div>
            <div class="activity-meta">
                <span>${time}</span>
                <button class="view-raw-btn" title="View Raw JSON" onclick="viewRawActivity('${b64}')">
                    <span style="font-size:1.2em">👁</span>
                </button>
            </div>
        </div>
    `;
}

function renderActivities(activities, forceScroll = false) {
    const activitiesContainer = document.getElementById('activities-container');
    if (activitiesContainer) {
        // Smart Scroll Logic
        const isAtBottom = (activitiesContainer.scrollHeight - activitiesContainer.scrollTop - activitiesContainer.clientHeight) < 50;

        activitiesContainer.innerHTML = '';
        if (activities && activities.length > 0) {
            activities.forEach(act => {
                activitiesContainer.innerHTML += renderActivity(act);
            });

            // If was at bottom OR forced, scroll to bottom
            if (isAtBottom || forceScroll) {
                activitiesContainer.scrollTop = activitiesContainer.scrollHeight;
            }
        } else {
            activitiesContainer.innerHTML = '<p style="text-align:center;color:#666">No activities.</p>';
        }
    }
}

async function updateSubscription(newSessionId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        if (currentSubscribedSessionId && currentSubscribedSessionId !== newSessionId) {
             ws.send(JSON.stringify({ type: 'unsubscribe' }));
        }
        if (newSessionId) {
            ws.send(JSON.stringify({ type: 'subscribe', sessionId: newSessionId }));
        }
    }
    currentSubscribedSessionId = newSessionId;
}

async function viewSession(sessionName) {
    currentSessionId = sessionName;
    renderSessions(); // Update active class in sidebar
    try {
        // Fetch session details
        const session = await apiCall(sessionName);

        const titleEl = document.getElementById('session-title');
        if(titleEl) titleEl.innerText = session.prompt || session.name;

        const infoEl = document.getElementById('session-info');
        if(infoEl) {
            infoEl.innerHTML = `
                <p><strong>ID:</strong> ${session.id}</p>
                <p><strong>State:</strong> <span class="${getStatusInfo(session.state).class}" style="display:inline-block;width:8px;height:8px;border-radius:50%"></span> ${session.state}</p>
                <p><strong>Prompt:</strong> ${session.prompt}</p>
            `;
        }

        // Fetch activities
        try {
            const activitiesData = await apiCall(`${sessionName}/activities`);
            // Force scroll to bottom on initial view
            renderActivities(activitiesData.activities, true);
        } catch (e) {
             console.warn("Could not fetch activities", e);
        }

        // Subscribe
        updateSubscription(session.id);

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
        await apiCall(`${currentSessionId}/sendMessage`, 'POST', { prompt });
        input.value = '';
        viewSession(currentSessionId);
    } catch (err) {
        console.error(err);
    }
}

async function approvePlan() {
    if (!currentSessionId) return;
    try {
        await apiCall(`${currentSessionId}/approvePlan`, 'POST', {});
        alert('Plan approved!');
        viewSession(currentSessionId);
    } catch (err) {
        console.error(err);
    }
}

async function refreshSession() {
    if (!currentSessionId) return;
    const btn = document.getElementById('refresh-session-btn');
    if (btn) btn.classList.add('rotating');

    try {
        await apiCall(`${currentSessionId}/refresh`, 'POST', {});
    } catch (err) {
        console.error(err);
    } finally {
        if(btn) btn.classList.remove('rotating');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

function filterSessions(e) {
    const term = e.target.value.toLowerCase();
    const sessionList = document.getElementById('session-list-sidebar');
    if (!sessionList) return;
    const items = sessionList.getElementsByClassName('session-item');
    for (let item of items) {
        const text = item.textContent.toLowerCase();
        if (text.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    }
}

// Event Listeners
const navCreate = document.getElementById('nav-create');
if(navCreate) {
    navCreate.addEventListener('click', () => {
        showView('create');
        loadSources();
    });
}

const createForm = document.getElementById('create-session-form');
if(createForm) createForm.addEventListener('submit', createSession);

const backToList = document.getElementById('back-to-list');
if(backToList) backToList.addEventListener('click', () => showView('list'));

const sendMsgBtn = document.getElementById('send-message-btn');
if(sendMsgBtn) sendMsgBtn.addEventListener('click', sendMessage);

// Enter to send in textarea
const msgInput = document.getElementById('message-input');
if(msgInput) {
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

const refreshBtn = document.getElementById('refresh-session-btn');
if(refreshBtn) refreshBtn.addEventListener('click', refreshSession);

// Filters
const filterStatus = document.getElementById('filter-status');
if(filterStatus) filterStatus.addEventListener('change', renderSessions);
const sortOrder = document.getElementById('sort-order');
if(sortOrder) sortOrder.addEventListener('change', renderSessions);

const filterSource = document.getElementById('filter-source');
if(filterSource) filterSource.addEventListener('change', renderSessions);
const filterRecent = document.getElementById('filter-recent');
if(filterRecent) filterRecent.addEventListener('change', renderSessions);

// Approve Plan Delegation
const activitiesContainer = document.getElementById('activities-container');
if(activitiesContainer) {
    activitiesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('approve-plan-button')) {
            approvePlan();
        }
    });
}

// Sidebar Toggle
const sidebarToggle = document.querySelector('.sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', toggleSidebar);
}

// Search
const searchInput = document.querySelector('.sidebar-search input');
if (searchInput) {
    searchInput.addEventListener('input', filterSessions);
}

// Global
window.viewSession = viewSession;

// Initial Load
listSessions();
