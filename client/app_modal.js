
function viewRawActivity(b64) {
    try {
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        const modal = document.getElementById('json-modal');
        const content = document.getElementById('json-content');
        if (modal && content) {
            content.innerText = JSON.stringify(JSON.parse(jsonStr), null, 2);
            modal.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error viewing raw activity", e);
    }
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
