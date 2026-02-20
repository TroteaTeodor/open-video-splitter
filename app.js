// Global state
let ffmpeg = null;
let videoFile = null;
let videoDuration = 0;
let videoExtension = 'mp4';
let videoMimeType = 'video/mp4';
let splitSegments = [];
let processingStartTime = null;
let currentSegmentIndex = 0;
let totalSegments = 0;

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
const progressTime = document.getElementById('progressTime');
const resultsGrid = document.getElementById('resultsGrid');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const startOverBtn = document.getElementById('startOverBtn');

// Preset durations in seconds
const PRESETS = {
    instagram: 60
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

    // Detect file extension and mime type
    const fileName = file.name;
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

    // Map extensions to mime types
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.m4v': 'video/x-m4v',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.3gp': 'video/3gpp',
        '.mts': 'video/mp2t',
        '.m2ts': 'video/mp2t',
        '.ts': 'video/mp2t'
    };

    // Use original extension or default to mp4
    videoExtension = ext || '.mp4';
    videoMimeType = mimeTypes[videoExtension] || file.type || 'video/mp4';

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

    totalSegments = segments.length;
    currentSegmentIndex = 0;

    try {
        // Load FFmpeg if not already loaded
        if (!ffmpeg) {
            updateProgress(0, 'Loading video processor...', 'First time may take 30-60 seconds');
            await loadFFmpeg();
        }

        updateProgress(5, 'Reading video file...', 'Preparing your video');

        // Start timing after FFmpeg is loaded
        processingStartTime = Date.now();

        // Read the input file - use original extension to preserve format
        const inputFileName = 'input' + videoExtension;
        const { fetchFile } = FFmpegUtil;
        const inputData = await fetchFile(videoFile);

        updateProgress(8, 'Loading video into memory...', `File size: ${formatFileSize(videoFile.size)}`);
        await ffmpeg.writeFile(inputFileName, inputData);

        splitSegments = [];

        for (let i = 0; i < segments.length; i++) {
            currentSegmentIndex = i;
            const segment = segments[i];
            const outputName = `segment_${String(i + 1).padStart(3, '0')}${videoExtension}`;

            const baseProgress = 10 + ((i / totalSegments) * 85);
            const segmentTime = formatTime(segment.start) + ' - ' + formatTime(segment.end);
            updateProgress(baseProgress, `Cutting segment ${i + 1} of ${totalSegments}`, segmentTime);

            // Run FFmpeg command to extract segment
            // -ss before -i = input seeking (fast), -c copy = no re-encoding (fastest)
            await ffmpeg.exec([
                '-ss', segment.start.toString(),
                '-i', inputFileName,
                '-t', segment.duration.toString(),
                '-c', 'copy',
                '-avoid_negative_ts', 'make_zero',
                '-map', '0',
                '-movflags', '+faststart',
                outputName
            ]);

            // Read the output file
            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data.buffer], { type: videoMimeType });

            splitSegments.push({
                name: outputName,
                blob: blob,
                url: URL.createObjectURL(blob),
                start: segment.start,
                end: segment.end
            });

            // Clean up the output file
            await ffmpeg.deleteFile(outputName);

            // Update progress after segment complete
            const completeProgress = 10 + (((i + 1) / totalSegments) * 85);
            updateProgress(completeProgress, `Completed segment ${i + 1} of ${totalSegments}`, getTimeEstimate(i + 1, totalSegments));
        }

        // Clean up input file
        await ffmpeg.deleteFile(inputFileName);

        const totalTime = formatDuration((Date.now() - processingStartTime) / 1000);
        updateProgress(100, 'Complete!', `Finished in ${totalTime}`);

        // Show results
        setTimeout(() => {
            showResults();
        }, 800);

    } catch (error) {
        console.error('Error processing video:', error);
        alert('Error processing video: ' + error.message);
        startOver();
    }
}

async function loadFFmpeg() {
    const { FFmpeg } = FFmpegWASM;

    let loadingDots = 0;
    const loadingInterval = setInterval(() => {
        loadingDots = (loadingDots + 1) % 4;
        const dots = '.'.repeat(loadingDots);
        updateProgress(50, `Loading video processor${dots}`, 'First load may take 30-60 seconds');
    }, 500);

    try {
        ffmpeg = new FFmpeg();

        ffmpeg.on('log', ({ message }) => {
            console.log('FFmpeg:', message);
        });

        ffmpeg.on('progress', ({ progress, time }) => {
            if (totalSegments > 0 && currentSegmentIndex < totalSegments) {
                const segmentProgress = Math.min(progress, 1);
                const baseProgress = 10 + ((currentSegmentIndex / totalSegments) * 85);
                const segmentContribution = (segmentProgress / totalSegments) * 85;
                const totalProgress = baseProgress + segmentContribution;

                const percent = Math.round(segmentProgress * 100);
                updateProgress(
                    totalProgress,
                    `Processing segment ${currentSegmentIndex + 1} of ${totalSegments} (${percent}%)`,
                    getTimeEstimate(currentSegmentIndex + segmentProgress, totalSegments)
                );
            }
        });

        updateProgress(10, 'Loading video processor...', 'Downloading WASM (31MB)');

        // Load directly from local files
        await ffmpeg.load({
            coreURL: 'lib/ffmpeg-core.js',
            wasmURL: 'lib/ffmpeg-core.wasm'
        });

        updateProgress(100, 'Video processor ready!', '');

    } catch (error) {
        clearInterval(loadingInterval);
        console.error('FFmpeg load error:', error);
        throw new Error('Failed to load video processor. Please refresh and try again.');
    }

    clearInterval(loadingInterval);
}

function getTimeEstimate(completed, total) {
    if (!processingStartTime || completed === 0) return '';

    const elapsed = (Date.now() - processingStartTime) / 1000;
    const avgTimePerSegment = elapsed / completed;
    const remaining = (total - completed) * avgTimePerSegment;

    if (remaining < 1) return 'Almost done...';

    return `~${formatDuration(remaining)} remaining`;
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateProgress(percent, text, subtext = '') {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
    if (progressTime) {
        progressTime.textContent = subtext;
    }
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
    processingStartTime = null;
    currentSegmentIndex = 0;
    totalSegments = 0;
    videoExtension = 'mp4';
    videoMimeType = 'video/mp4';

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
