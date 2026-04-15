// App State
let chartInstance = null;

// Utility function to calculate seek stats
function calculateMetrics(sequence, currentHead, numRequests) {
    let totalSeek = 0;
    let prev = currentHead;
    for (let cyl of sequence) {
        totalSeek += Math.abs(cyl - prev);
        prev = cyl;
    }
    const avgSeek = numRequests > 0 ? (totalSeek / numRequests).toFixed(2) : 0;
    
    return {
        sequence: [currentHead, ...sequence], // Include start position for graph
        totalSeek,
        avgSeek,
        numRequests
    };
}

// Algorithms
function performFCFS(requests, head) {
    return calculateMetrics([...requests], head, requests.length);
}

function performSSTF(requests, head) {
    let unvisited = [...requests];
    let current = head;
    let sequence = [];
    
    while (unvisited.length > 0) {
        let closestIndex = 0;
        let minDiff = Math.abs(current - unvisited[0]);
        for (let i = 1; i < unvisited.length; i++) {
            let diff = Math.abs(current - unvisited[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        current = unvisited[closestIndex];
        sequence.push(current);
        unvisited.splice(closestIndex, 1);
    }
    
    return calculateMetrics(sequence, head, requests.length);
}

function performSCAN(requests, head, maxCylinders, direction) {
    let sequence = [];
    let left = requests.filter(r => r < head).sort((a,b) => a-b);
    let right = requests.filter(r => r >= head).sort((a,b) => a-b);
    
    if (direction === 'right') {
        sequence = [...right, maxCylinders, ...left.reverse()];
    } else {
        sequence = [...left.reverse(), 0, ...right];
    }
    
    let cleanSequence = [];
    for(let sys of sequence) {
        if(cleanSequence.length === 0 || cleanSequence[cleanSequence.length-1] !== sys) {
            cleanSequence.push(sys);
        }
    }
    
    return calculateMetrics(cleanSequence, head, requests.length);
}

function performCSCAN(requests, head, maxCylinders, direction) {
    let sequence = [];
    let left = requests.filter(r => r < head).sort((a,b) => a-b);
    let right = requests.filter(r => r >= head).sort((a,b) => a-b);
    
    if (direction === 'right') {
        sequence = [...right, maxCylinders, 0, ...left];
    } else {
        sequence = [...left.reverse(), 0, maxCylinders, ...right.reverse()];
    }
    
    let cleanSequence = [];
    for(let sys of sequence) {
        if(cleanSequence.length === 0 || cleanSequence[cleanSequence.length-1] !== sys) {
            cleanSequence.push(sys);
        }
    }
    return calculateMetrics(cleanSequence, head, requests.length);
}

// Chart.js Configuration
const colors = {
    FCFS: '#f43f5e', 
    SSTF: '#3b82f6', 
    SCAN: '#10b981', 
    CSCAN: '#f59e0b' 
};

function renderChart(datasets, maxCylinders) {
    const ctx = document.getElementById('trajectoryChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    let maxSteps = Math.max(...datasets.map(ds => ds.sequence.length));
    const labels = Array.from({length: maxSteps}, (_, i) => `Step ${i}`);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets.map(algo => ({
                label: algo.name,
                data: algo.sequence,
                borderColor: colors[algo.name] || '#fff',
                backgroundColor: colors[algo.name] || '#fff',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: false,
                tension: 0,
                stepped: false
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: '#94a3b8',
            scales: {
                y: {
                    title: { display: true, text: 'Cylinder Position', color: '#94a3b8' },
                    min: 0,
                    max: maxCylinders,
                    reverse: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    title: { display: true, text: 'Process Sequence', color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc', font: { family: 'Inter', size: 14 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            }
        }
    });
}

function renderMetrics(results) {
    const container = document.getElementById('metricsOutput');
    container.innerHTML = ''; 
    
    results.forEach(res => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.style.borderTopColor = colors[res.name];
        
        const throughput = res.totalSeek > 0 ? (res.numRequests / res.totalSeek).toFixed(4) : 0;
        
        card.innerHTML = `
            <div class="metric-title">${res.name}</div>
            <div class="metric-data">
                <span>Total Seek</span>
                <strong>${res.totalSeek}</strong>
            </div>
            <div class="metric-data">
                <span>Avg Seek</span>
                <strong>${res.avgSeek}</strong>
            </div>
            <div class="metric-data" title="Requests served per unit of head traversal distance">
                <span>Throughput</span>
                <strong>${throughput}</strong>
            </div>
        `;
        container.appendChild(card);
    });
}

document.getElementById('simulatorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const reqStr = document.getElementById('requests').value;
    const requests = reqStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const head = parseInt(document.getElementById('initialPos').value);
    const maxCylinders = parseInt(document.getElementById('maxCylinders').value);
    const direction = document.getElementById('direction').value;
    
    if (requests.some(r => r < 0 || r > maxCylinders)) {
        alert("Error: Some requests fall outside the disk boundaries (0 - " + maxCylinders + ").");
        return;
    }
    if (head < 0 || head > maxCylinders) {
        alert("Error: Initial Head position is fully outside disk boundaries!");
        return;
    }
    
    const checkboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked');
    const selectedAlgorithms = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedAlgorithms.length === 0) {
        alert("Please select at least one algorithm!");
        return;
    }
    
    const results = [];
    const chartData = [];
    
    if (selectedAlgorithms.includes("FCFS")) {
        const res = performFCFS([...requests], head);
        results.push({ name: 'FCFS', ...res });
        chartData.push({ name: 'FCFS', sequence: res.sequence });
    }
    if (selectedAlgorithms.includes("SSTF")) {
        const res = performSSTF([...requests], head);
        results.push({ name: 'SSTF', ...res });
        chartData.push({ name: 'SSTF', sequence: res.sequence });
    }
    if (selectedAlgorithms.includes("SCAN")) {
        const res = performSCAN([...requests], head, maxCylinders, direction);
        results.push({ name: 'SCAN', ...res });
        chartData.push({ name: 'SCAN', sequence: res.sequence });
    }
    if (selectedAlgorithms.includes("CSCAN")) {
        const res = performCSCAN([...requests], head, maxCylinders, direction);
        results.push({ name: 'CSCAN', ...res });
        chartData.push({ name: 'CSCAN', sequence: res.sequence });
    }
    
    renderChart(chartData, maxCylinders);
    renderMetrics(results);
});
