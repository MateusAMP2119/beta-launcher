async function fetchStats() {
    const visitorsEl = document.getElementById('totalVisitors');
    const joinsEl = document.getElementById('totalJoins');
    const feedbackEl = document.getElementById('totalFeedback');
    const rateEl = document.getElementById('conversionRate');
    const tableEl = document.getElementById('leadsTable');
    const feedbackTableEl = document.getElementById('feedbackTable');

    try {
        const response = await fetch('/api/stats/data');

        if (response.status === 401) {
            throw new Error('Authentication required');
        }

        const data = await response.json();

        // Update Cards
        visitorsEl.textContent = data.totalVisitors;
        joinsEl.textContent = data.totalJoins;
        feedbackEl.textContent = data.totalFeedback;

        const rate = data.totalVisitors > 0
            ? ((data.totalJoins / data.totalVisitors) * 100).toFixed(1)
            : 0;
        rateEl.textContent = `${rate}%`;

        // Update Table
        if (data.leads.length === 0) {
            tableEl.innerHTML = '<div class="loading">No signups yet.</div>';
        } else {
            const sortedLeads = data.leads.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            tableEl.innerHTML = '';
            const table = document.createElement('table');

            // Header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            ['Email', 'API Access', 'Date', 'Actions'].forEach(text => {
                const th = document.createElement('th');
                th.textContent = text;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Body
            const tbody = document.createElement('tbody');
            sortedLeads.forEach(lead => {
                const tr = document.createElement('tr');

                // Email
                const tdEmail = document.createElement('td');
                tdEmail.textContent = lead.email || 'N/A';
                tr.appendChild(tdEmail);

                // API Access
                const tdApi = document.createElement('td');
                const span = document.createElement('span');
                span.className = lead.apiAccess ? 'tag tag-yes' : 'tag tag-no';
                span.textContent = lead.apiAccess ? 'YES' : 'NO';
                tdApi.appendChild(span);
                tr.appendChild(tdApi);

                // Date
                const tdDate = document.createElement('td');
                tdDate.textContent = new Date(lead.timestamp).toLocaleDateString() + ' ' +
                    new Date(lead.timestamp).toLocaleTimeString();
                tr.appendChild(tdDate);

                // Actions
                const tdActions = document.createElement('td');
                const btn = document.createElement('button');
                btn.className = 'delete-btn';
                btn.textContent = 'Delete';
                btn.onclick = () => deleteSubmission(lead.id);
                tdActions.appendChild(btn);
                tr.appendChild(tdActions);

                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            tableEl.appendChild(table);
        }

        // Update Feedback Table
        if (!data.feedback || data.feedback.length === 0) {
            feedbackTableEl.innerHTML = '<div class="loading">No feedback yet.</div>';
        } else {
            const sortedFeedback = data.feedback.sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            feedbackTableEl.innerHTML = '';
            const fTable = document.createElement('table');

            // Header
            const fThead = document.createElement('thead');
            const fHeaderRow = document.createElement('tr');
            ['Message', 'Date', 'Actions'].forEach(text => {
                const th = document.createElement('th');
                th.textContent = text;
                fHeaderRow.appendChild(th);
            });
            fThead.appendChild(fHeaderRow);
            fTable.appendChild(fThead);

            // Body
            const fTbody = document.createElement('tbody');
            sortedFeedback.forEach(item => {
                const tr = document.createElement('tr');

                // Message (Safe)
                const tdMsg = document.createElement('td');
                tdMsg.textContent = item.content || 'N/A';
                tr.appendChild(tdMsg);

                // Date
                const tdDate = document.createElement('td');
                tdDate.textContent = new Date(item.timestamp).toLocaleDateString() + ' ' +
                    new Date(item.timestamp).toLocaleTimeString();
                tr.appendChild(tdDate);

                // Actions
                const tdActions = document.createElement('td');
                const btn = document.createElement('button');
                btn.className = 'delete-btn';
                btn.textContent = 'Delete';
                btn.onclick = () => deleteSubmission(item.id);
                tdActions.appendChild(btn);
                tr.appendChild(tdActions);

                fTbody.appendChild(tr);
            });
            fTable.appendChild(fTbody);
            feedbackTableEl.appendChild(fTable);
        }

    } catch (err) {
        console.error(err);
        tableEl.innerHTML = '<div class="loading" style="color: #ff6b6b">Failed to load data.</div>';
    }
}

async function deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this record?')) {
        return;
    }

    try {
        const response = await fetch(`/api/submissions/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fetchStats(); // Refresh the data
        } else {
            alert('Failed to delete submission');
        }
    } catch (err) {
        console.error('Error deleting submission:', err);
        alert('Error deleting submission');
    }
}

// Initial load
fetchStats();
