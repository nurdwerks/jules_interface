
function showJsonModal(b64, title) {
    try {
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        const modal = document.getElementById('json-modal');
        const content = document.getElementById('json-content');
        const titleEl = modal.querySelector('.modal-header h2');

        if (modal && content) {
            content.innerText = JSON.stringify(JSON.parse(jsonStr), null, 2);
            if (titleEl) titleEl.innerText = title;
            modal.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error viewing json", e);
    }
}

function viewRawActivity(b64) {
    showJsonModal(b64, "Raw Activity Data");
}

function viewArtifact(b64) {
    showJsonModal(b64, "Artifact Content");
}

function viewRawSession(b64) {
    showJsonModal(b64, "Raw Session Data");
}

// Modal Close Handlers
const jsonModal = document.getElementById('json-modal');
if (jsonModal) {
    const closeBtn = jsonModal.querySelector('.close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            jsonModal.classList.add('hidden');
        });
    }
    // Click outside to close
    jsonModal.addEventListener('click', (e) => {
        if (e.target === jsonModal) {
            jsonModal.classList.add('hidden');
        }
    });
}
window.viewRawActivity = viewRawActivity;
window.viewArtifact = viewArtifact;
window.viewRawSession = viewRawSession;
