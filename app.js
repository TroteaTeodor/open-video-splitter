// Global state
let ffmpeg = null;
let videoFile = null;
let videoDuration = 0;
let splitSegments = [];

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const uploadSection = document.getElementById('uploadSection');
const previewSection = document.getElementById('previewSection');
const optionsSection = document.getElementById('optionsSection');
const progressSection = document.getElementById('progressSection');
const resultsSection = document.getElementById('resultsSection');
const videoPreview = document.getElementById('videoPreview');
const videoName = document.getElementById('videoName');
const videoDurationEl = document.getElementById('videoDuration');
const changeVideoBtn = document.getElementById('changeVideoBtn');
const customOptions = document.getElementById('customOptions');
const intervalInput = document.getElementById('intervalInput');
const timestampsInput = document.getElementById('timestampsInput');
const splitBtn = document.getElementById('splitBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultsGrid = document.getElementById('resultsGrid');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const startOverBtn = document.getElementById('startOverBtn');

// Preset durations in seconds
const PRESETS = {
    instagram: 15,
    tiktok: 60
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Upload handlers
    uploadArea.addEventListener('click', () => videoInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    videoInput.addEventListener('change', handleFileSelect);

    // Change video button
    changeVideoBtn.addEventListener('click', resetToUpload);

    // Split mode radio buttons
    document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
        radio.addEventListener('change', handleSplitModeChange);
    });

    // Custom mode radio buttons
    document.querySelectorAll('input[name="customMode"]').forEach(radio => {
        radio.addEventListener('change', handleCustomModeChange);
    });

    // Split button
    splitBtn.addEventListener('click', handleSplit);

    // Results actions
    downloadAllBtn.addEventListener('click', downloadAllAsZip);
    startOverBtn.addEventListener('click', startOver);
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function processFile(file) {
    videoFile = file;

    // Create object URL for preview
    const url = URL.createObjectURL(file);
    videoPreview.src = url;

    // Get video metadata
    videoPreview.onloadedmetadata = () => {
        videoDuration = videoPreview.duration;
        videoName.textContent = file.name;
        videoDurationEl.textContent = formatTime(videoDuration);

        // Show preview and options
        uploadSection.classList.add('hidden');
        previewSection.classList.remove('hidden');
        optionsSection.classList.remove('hidden');
    };
}

function resetToUpload() {
    videoFile = null;
    videoDuration = 0;
    videoInput.value = '';
    videoPreview.src = '';

    uploadSection.classList.remove('hidden');
    previewSection.classList.add('hidden');
    optionsSection.classList.add('hidden');
}

function handleSplitModeChange(e) {
    if (e.target.value === 'custom') {
        customOptions.classList.remove('hidden');
    } else {
        customOptions.classList.add('hidden');
    }
}

function handleCustomModeChange(e) {
    if (e.target.value === 'interval') {
        intervalInput.classList.remove('hidden');
        timestampsInput.classList.add('hidden');
    } else {
        intervalInput.classList.add('hidden');
        timestampsInput.classList.remove('hidden');
    }
}

async function handleSplit() {
    const splitMode = document.querySelector('input[name="splitMode"]:checked').value;
    let segments = [];

    if (splitMode === 'custom') {
        const customMode = document.querySelector('input[name="customMode"]:checked').value;

        if (customMode === 'interval') {
            const duration = parseInt(document.getElementById('segmentDuration').value);
            if (!duration || duration < 1) {
                alert('Please enter a valid segment duration');
                return;
            }
            segments = calculateSegmentsByInterval(duration);
        } else {
            const timestampStr = document.getElementById('timestamps').value;
            segments = calculateSegmentsByTimestamps(timestampStr);
            if (!segments) {
                alert('Please enter valid timestamps');
                return;
            }
        }
    } else {
        const duration = PRESETS[splitMode];
        segments = calculateSegmentsByInterval(duration);
    }

    if (segments.length === 0) {
        alert('No segments to create');
        return;
    }

    // Start processing
    await processVideo(segments);
}

function calculateSegmentsByInterval(intervalSeconds) {
    const segments = [];
    let currentTime = 0;

    while (currentTime < videoDuration) {
        const endTime = Math.min(currentTime + intervalSeconds, videoDuration);
        segments.push({
            start: currentTime,
            end: endTime,
            duration: endTime - currentTime
        });
        currentTime = endTime;
    }

    return segments;
}

function calculateSegmentsByTimestamps(timestampStr) {
    if (!timestampStr.trim()) return null;

    const timestamps = [0]; // Always start from 0
    const parts = timestampStr.split(',').map(t => t.trim());

    for (const part of parts) {
        const seconds = parseTimestamp(part);
        if (seconds === null || seconds < 0 || seconds > videoDuration) {
            return null;
        }
        timestamps.push(seconds);
    }

    timestamps.push(videoDuration); // Always end at video duration

    // Sort and remove duplicates
    const unique = [...new Set(timestamps)].sort((a, b) => a - b);

    const segments = [];
    for (let i = 0; i < unique.length - 1; i++) {
        segments.push({
            start: unique[i],
            end: unique[i + 1],
            duration: unique[i + 1] - unique[i]
        });
    }

    return segments;
}

function parseTimestamp(str) {
    str = str.trim();

    // Check if it's just seconds
    if (/^\d+(\.\d+)?$/.test(str)) {
        return parseFloat(str);
    }

    // Check MM:SS format
    const match = str.match(/^(\d+):(\d{1,2})$/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }

    // Check HH:MM:SS format
    const matchHMS = str.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (matchHMS) {
        return parseInt(matchHMS[1]) * 3600 + parseInt(matchHMS[2]) * 60 + parseInt(matchHMS[3]);
    }

    return null;
}

async function processVideo(segments) {
    // Show progress section
    optionsSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    progressSection.classList.remove('hidden');

    try {
        // Load FFmpeg if not already loaded
        if (!ffmpeg) {
            updateProgress(0, 'Loading FFmpeg (this may take a moment)...');
            await loadFFmpeg();
        }

        updateProgress(10, 'Reading video file...');

        // Read the input file
        const { fetchFile } = FFmpegUtil;
        const inputData = await fetchFile(videoFile);
        await ffmpeg.writeFile('input.mp4', inputData);

        splitSegments = [];
        const totalSegments = segments.length;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const outputName = `segment_${String(i + 1).padStart(3, '0')}.mp4`;

            const progress = 10 + ((i / totalSegments) * 80);
            updateProgress(progress, `Processing segment ${i + 1} of ${totalSegments}...`);

            // Run FFmpeg command to extract segment
            await ffmpeg.exec([
                '-i', 'input.mp4',
                '-ss', segment.start.toString(),
                '-t', segment.duration.toString(),
                '-c', 'copy',
                '-avoid_negative_ts', '1',
                outputName
            ]);

            // Read the output file
            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data.buffer], { type: 'video/mp4' });

            splitSegments.push({
                name: outputName,
                blob: blob,
                url: URL.createObjectURL(blob),
                start: segment.start,
                end: segment.end
            });

            // Clean up the output file
            await ffmpeg.deleteFile(outputName);
        }

        // Clean up input file
        await ffmpeg.deleteFile('input.mp4');

        updateProgress(100, 'Complete!');

        // Show results
        setTimeout(() => {
            showResults();
        }, 500);

    } catch (error) {
        console.error('Error processing video:', error);
        alert('Error processing video: ' + error.message);
        startOver();
    }
}

async function loadFFmpeg() {
    const { FFmpeg } = FFmpegWASM;
    ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100);
        updateProgress(10 + (percent * 0.8), `Processing... ${percent}%`);
    });

    // Load FFmpeg core from CDN
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
    });
}

function updateProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
}

function showResults() {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    resultsGrid.innerHTML = '';

    splitSegments.forEach((segment, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <video src="${segment.url}" controls></video>
            <div class="result-info">
                <span class="result-name">Part ${index + 1}</span>
                <button class="result-download" data-index="${index}">Download</button>
            </div>
        `;
        resultsGrid.appendChild(item);
    });

    // Add download handlers
    resultsGrid.querySelectorAll('.result-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            downloadSegment(index);
        });
    });
}

function downloadSegment(index) {
    const segment = splitSegments[index];
    const a = document.createElement('a');
    a.href = segment.url;
    a.download = segment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function downloadAllAsZip() {
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = 'Creating ZIP...';

    try {
        const zip = new JSZip();

        for (const segment of splitSegments) {
            const arrayBuffer = await segment.blob.arrayBuffer();
            zip.file(segment.name, arrayBuffer);
        }

        const content = await zip.generateAsync({ type: 'blob' });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = 'video_segments.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('Error creating ZIP file');
    }

    downloadAllBtn.disabled = false;
    downloadAllBtn.textContent = 'Download All (ZIP)';
}

function startOver() {
    // Clean up URLs
    splitSegments.forEach(segment => {
        URL.revokeObjectURL(segment.url);
    });
    splitSegments = [];

    // Reset UI
    resultsSection.classList.add('hidden');
    progressSection.classList.add('hidden');

    resetToUpload();
}

// Utility functions
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
