// State
let currentSessionId = null;

// Mock Data
const mockSessions = [
    {
        name: "sessions/mock-session-1",
        id: "mock-session-1",
        prompt: "Fix the bug in the login page",
        state: "IN_PROGRESS",
        createTime: "2023-10-27T10:00:00Z"
    },
    {
        name: "sessions/mock-session-2",
        id: "mock-session-2",
        prompt: "Add a new feature to the dashboard",
        state: "AWAITING_PLAN_APPROVAL",
        createTime: "2023-10-28T14:30:00Z"
    }
];

const mockActivities = {
    "mock-session-1": [
        {
            name: "sessions/mock-session-1/activities/1",
            agentMessaged: { agentMessage: "I have analyzed the code and found the issue." },
            createTime: "2023-10-27T10:05:00Z"
        },
        {
            name: "sessions/mock-session-1/activities/2",
            planGenerated: {
                plan: {
                    steps: [
                        { title: "Read login.js", description: "Read the file to understand the logic." },
                        { title: "Fix typo", description: "Correct the typo in variable name." }
                    ]
                }
            },
            createTime: "2023-10-27T10:06:00Z"
        }
    ],
    "mock-session-2": [
        {
            name: "sessions/mock-session-2/activities/1",
            userMessaged: { userMessage: "Please add a chart to the dashboard." },
            createTime: "2023-10-28T14:30:00Z"
        }
    ]
};

// DOM Elements
const views = {
    list: document.getElementById('view-list'),
    create: document.getElementById('view-create'),
    details: document.getElementById('view-details')
};

const apiKeyInput = document.getElementById('apiKey');
const mockModeCheckbox = document.getElementById('mockMode');

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const isMock = mockModeCheckbox.checked;

    if (isMock) {
        return handleMockApi(endpoint, method, body);
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Please enter an API Key or enable Mock Mode.");
        throw new Error("No API Key");
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    let url = `https://jules.googleapis.com/v1alpha/${endpoint}`;

    // Check if the key looks like an API key (starts with AIza...)
    if (apiKey.startsWith('AIza')) {
       url += (url.includes('?') ? '&' : '?') + `key=${apiKey}`;
       delete headers['Authorization'];
    }

    const options = {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API Error');
        }
        // Handle empty responses (like from sendMessage or approvePlan)
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (err) {
        alert(`Error: ${err.message}`);
        throw err;
    }
}

function handleMockApi(endpoint, method, body) {
    console.log(`Mock API Call: ${method} ${endpoint}`, body);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (endpoint === 'sessions' && method === 'GET') {
                resolve({ sessions: mockSessions });
            } else if (endpoint === 'sessions' && method === 'POST') {
                const newSession = {
                    name: `sessions/mock-session-${Date.now()}`,
                    id: `mock-session-${Date.now()}`,
                    prompt: body.prompt,
                    state: "QUEUED",
                    createTime: new Date().toISOString()
                };
                mockSessions.push(newSession);
                // Also initialize empty activities for this new session
                mockActivities[newSession.id] = [];
                resolve(newSession);
            } else if (endpoint.match(/^sessions\/.*\/activities$/) && method === 'GET') {
                const sessionId = endpoint.split('/')[1];
                // In real API, endpoint is sessions/{session_id}/activities
                // For mock, we map session ID (e.g. mock-session-1) to activities
                // But endpoint passed here is like "sessions/mock-session-1/activities"
                // So splitting by '/' gives ["sessions", "mock-session-1", "activities"]
                const realSessionId = endpoint.split('/')[1];
                resolve({ activities: mockActivities[realSessionId] || [] });
            } else if (endpoint.match(/^sessions\/.*$/) && method === 'GET') {
                 const sessionName = endpoint;
                 const session = mockSessions.find(s => s.name === sessionName);
                 resolve(session);
            } else if (endpoint.endsWith(':sendMessage')) {
                // Mock adding the message to activities
                const sessionName = endpoint.split(':')[0];
                const sessionId = sessionName.split('/')[1];
                if (mockActivities[sessionId]) {
                    mockActivities[sessionId].push({
                        name: `${sessionName}/activities/${Date.now()}`,
                        userMessaged: { userMessage: body.prompt },
                        createTime: new Date().toISOString()
                    });
                }
                resolve({});
            } else if (endpoint.endsWith(':approvePlan')) {
                const sessionName = endpoint.split(':')[0];
                const session = mockSessions.find(s => s.name === sessionName);
                if (session) session.state = "IN_PROGRESS";
                resolve({});
            } else {
                reject(new Error("Mock endpoint not implemented"));
            }
        }, 300);
    });
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
        // Update: Documentation says request body should be { "prompt": string }
        await apiCall(`${currentSessionId}:sendMessage`, 'POST', { prompt });
        input.value = '';
        // Refresh view to see new message
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
window.viewSession = viewSession; // Make available for inline onclick

// Initial Load
listSessions();
