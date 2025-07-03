class GradientMapTool {
    constructor() {
        this.outputCanvas = document.getElementById('outputCanvas');
        this.colorInput = document.getElementById('colorInput');
        this.gradientPreview = document.getElementById('gradientPreview');
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.saveBtn = document.getElementById('saveBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.originalImage = null;
        this.gradientStops = [];
        this.copyTimeout = null;
        this.gradientPresets = [];
        this.selectedPresetIndex = null;
        this.gradientPresetsContainer = document.getElementById('gradientPresets');
        this.saveGradientBtn = document.getElementById('saveGradientBtn');

        this.setupEventListeners();
        this.loadFromURL();
        this.showUploadArea();
        this.loadPresetsFromStorage();
        this.renderPresets();
    }

    setupEventListeners() {
        this.colorInput.addEventListener('input', () => this.updateGradient());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.saveBtn.addEventListener('click', () => this.saveImage());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.setupUploadAreaEvents();
        this.setupKeyboardShortcuts();
        this.saveGradientBtn.addEventListener('click', () => this.saveCurrentGradientAsPreset());
        // Keyboard delete for selected preset, only if color input is not focused
        document.addEventListener('keydown', (e) => {
            if (
                this.selectedPresetIndex !== null &&
                (e.key === 'Delete' || e.key === 'Backspace') &&
                document.activeElement !== this.colorInput
            ) {
                this.deleteSelectedPreset();
            }
        });
        // When color input changes, clear selected preset
        this.colorInput.addEventListener('input', () => {
            if (this.selectedPresetIndex !== null) {
                this.selectedPresetIndex = null;
                this.renderPresets();
            }
        });
    }

    setupUploadAreaEvents() {
        // Drag and drop for upload area
        const zone = this.uploadArea;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, () => {
                zone.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, () => {
                zone.classList.remove('dragover');
            });
        });
        zone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        // Click to browse
        zone.addEventListener('click', (e) => {
            if (e.target === this.uploadArea || e.target.classList.contains('upload-text')) {
                this.fileInput.value = '';
                this.fileInput.click();
            }
        });
    }

    setupCanvasUploadEvents() {
        // Remove any previous listeners to avoid duplicates
        this.outputCanvas.onclick = null;
        this.outputCanvas.ondragenter = null;
        this.outputCanvas.ondragover = null;
        this.outputCanvas.ondragleave = null;
        this.outputCanvas.ondrop = null;

        // Click to browse
        this.outputCanvas.onclick = () => {
            this.fileInput.value = '';
            this.fileInput.click();
        };
        // Drag and drop
        this.outputCanvas.ondragenter = this.outputCanvas.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.outputCanvas.classList.add('dragover');
        };
        this.outputCanvas.ondragleave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.outputCanvas.classList.remove('dragover');
        };
        this.outputCanvas.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.outputCanvas.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        };
    }

    removeCanvasUploadEvents() {
        this.outputCanvas.onclick = null;
        this.outputCanvas.ondragenter = null;
        this.outputCanvas.ondragover = null;
        this.outputCanvas.ondragleave = null;
        this.outputCanvas.ondrop = null;
    }

    showUploadArea() {
        this.uploadArea.classList.remove('hidden');
        this.outputCanvas.classList.add('hidden');
        this.removeCanvasUploadEvents();
    }

    showCanvas() {
        this.uploadArea.classList.add('hidden');
        this.outputCanvas.classList.remove('hidden');
        this.setupCanvasUploadEvents();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement !== this.colorInput) {
                e.preventDefault();
                this.handlePaste();
            }
        });
    }

    async handlePaste() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    this.loadImageFromBlob(blob);
                    return;
                }
            }
        } catch (err) {
            // Log warning for debugging, but do not break UX
            console.warn('Clipboard read failed or not supported:', err);
        }
        this.createPasteArea();
    }

    createPasteArea() {
        const pasteDiv = document.createElement('div');
        pasteDiv.contentEditable = true;
        pasteDiv.style.position = 'fixed';
        pasteDiv.style.top = '-1000px';
        pasteDiv.style.left = '-1000px';
        pasteDiv.style.opacity = '0';
        pasteDiv.style.pointerEvents = 'none';
        document.body.appendChild(pasteDiv);
        pasteDiv.focus();
        const handlePasteEvent = (e) => {
            e.preventDefault();
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    this.loadImageFromBlob(blob);
                    break;
                }
            }
            document.body.removeChild(pasteDiv);
        };
        pasteDiv.addEventListener('paste', handlePasteEvent);
        setTimeout(() => {
            if (document.body.contains(pasteDiv)) {
                document.body.removeChild(pasteDiv);
            }
        }, 1000);
    }

    loadImageFromBlob(blob) {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            this.originalImage = img;
            this.drawImageToCanvas();
            this.applyGradientMap();
            this.showCanvas();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    parseColorInput(input) {
        const colors = input.split(/[\s,]+/).filter(c => c.trim());
        const stops = [];
        colors.forEach((color, index) => {
            let hexColor = color.trim().toUpperCase();
            let position = null;
            if (hexColor.includes('-')) {
                const parts = hexColor.split('-');
                hexColor = parts[0];
                position = parseInt(parts[1]) / 100;
            }
            if (!hexColor.startsWith('#')) {
                hexColor = '#' + hexColor;
            }
            if (/^#[0-9A-F]{6}$/i.test(hexColor)) {
                if (position === null) {
                    position = colors.length > 1 ? index / (colors.length - 1) : 0;
                }
                stops.push({ color: hexColor, position: Math.max(0, Math.min(1, position)) });
            }
        });
        stops.sort((a, b) => a.position - b.position);
        return stops;
    }

    updateGradient() {
        this.gradientStops = this.parseColorInput(this.colorInput.value);
        this.updateGradientPreview();
        this.updateURL();
        if (this.originalImage) {
            this.applyGradientMap();
        }
    }

    updateGradientPreview() {
        if (!this.gradientPreview) return;
        if (this.gradientStops.length === 0) {
            this.gradientPreview.style.background = '#ccc';
            return;
        }
        const gradientString = this.gradientStops
            .map(stop => `${stop.color} ${stop.position * 100}%`)
            .join(', ');
        this.gradientPreview.style.background = `linear-gradient(to right, ${gradientString})`;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.drawImageToCanvas();
                this.applyGradientMap();
                this.showCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    drawImageToCanvas() {
        if (!this.originalImage || !this.outputCanvas) return;
        this.outputCanvas.width = this.originalImage.width;
        this.outputCanvas.height = this.originalImage.height;
        this.outputCanvas.style.width = '';
        this.outputCanvas.style.height = '';
        const ctx = this.outputCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        ctx.drawImage(this.originalImage, 0, 0, this.originalImage.width, this.originalImage.height);
        this.outputCanvas.classList.remove('hidden');
    }

    applyGradientMap() {
        if (!this.originalImage || !this.outputCanvas || this.gradientStops.length === 0) {
            return;
        }
        this.drawImageToCanvas();
        const ctx = this.outputCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        const data = imageData.data;
        const gradientLUT = this.createGradientLUT();
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const luminance = Math.round((0.299 * r + 0.587 * g + 0.114 * b));
            const gradientColor = gradientLUT[luminance];
            data[i] = gradientColor.r;
            data[i + 1] = gradientColor.g;
            data[i + 2] = gradientColor.b;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    createGradientLUT() {
        const lut = new Array(256);
        for (let i = 0; i < 256; i++) {
            const position = i / 255;
            lut[i] = this.getGradientColor(position);
        }
        return lut;
    }

    getGradientColor(position) {
        if (this.gradientStops.length === 0) {
            return { r: 0, g: 0, b: 0 };
        }
        if (this.gradientStops.length === 1) {
            return this.hexToRgb(this.gradientStops[0].color);
        }
        let leftStop = this.gradientStops[0];
        let rightStop = this.gradientStops[this.gradientStops.length - 1];
        for (let i = 0; i < this.gradientStops.length - 1; i++) {
            if (position >= this.gradientStops[i].position && position <= this.gradientStops[i + 1].position) {
                leftStop = this.gradientStops[i];
                rightStop = this.gradientStops[i + 1];
                break;
            }
        }
        const leftColor = this.hexToRgb(leftStop.color);
        const rightColor = this.hexToRgb(rightStop.color);
        const range = rightStop.position - leftStop.position;
        const factor = range === 0 ? 0 : (position - leftStop.position) / range;
        return {
            r: Math.round(leftColor.r + (rightColor.r - leftColor.r) * factor),
            g: Math.round(leftColor.g + (rightColor.g - leftColor.g) * factor),
            b: Math.round(leftColor.b + (rightColor.b - leftColor.b) * factor)
        };
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    saveImage() {
        if (!this.outputCanvas || this.outputCanvas.classList.contains('hidden')) return;
        this.outputCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gradient-mapped-image.png';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    copyToClipboard() {
        if (!this.outputCanvas || this.outputCanvas.classList.contains('hidden')) return;
        const originalText = this.copyBtn.textContent;
        this.outputCanvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                this.copyBtn.textContent = 'Copied!';
            } catch (err) {
                this.copyBtn.textContent = 'Downloading...';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gradient-mapped-image.png';
                a.click();
                URL.revokeObjectURL(url);
            }
            if (this.copyTimeout) {
                clearTimeout(this.copyTimeout);
            }
            this.copyTimeout = setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 2000);
        });
    }

    updateURL() {
        const colors = encodeURIComponent(this.colorInput.value);
        if (typeof window !== 'undefined' && window.location) {
            window.location.hash = `colors=${colors}`;
        }
    }

    loadFromURL() {
        try {
            if (window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.slice(1));
                const colors = hashParams.get('colors');
                if (colors) {
                    this.colorInput.value = decodeURIComponent(colors);
                    this.updateGradient();
                    return;
                }
            }
            const params = new URLSearchParams(window.location.search);
            const colors = params.get('colors');
            if (colors) {
                this.colorInput.value = decodeURIComponent(colors);
            }
        } catch (e) {
            // Log warning for debugging, but do not break UX
            console.warn('Failed to load colors from URL:', e);
        }
        this.updateGradient();
    }

    saveCurrentGradientAsPreset() {
        const colors = this.colorInput.value.trim();
        if (!colors || this.gradientStops.length === 0) return;
        // Prevent duplicate presets
        if (this.gradientPresets.some(p => p.colors === colors)) return;
        this.gradientPresets.push({ colors });
        this.selectedPresetIndex = this.gradientPresets.length - 1;
        this.savePresetsToStorage();
        this.renderPresets();
    }

    renderPresets() {
        this.gradientPresetsContainer.innerHTML = '';
        this.gradientPresets.forEach((preset, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gradient-preset-btn' + (this.selectedPresetIndex === idx ? ' selected' : '');
            btn.title = preset.colors;
            btn.style.background = this.getGradientPreviewStyle(preset.colors);
            btn.setAttribute('tabindex', '0');
            btn.addEventListener('click', () => {
                this.selectedPresetIndex = idx;
                this.colorInput.value = preset.colors;
                this.updateGradient();
                this.renderPresets();
            });
            this.gradientPresetsContainer.appendChild(btn);
        });
    }

    getGradientPreviewStyle(colors) {
        const stops = this.parseColorInput(colors);
        if (stops.length === 0) return '#ccc';
        return `linear-gradient(to right, ${stops.map(stop => `${stop.color} ${stop.position * 100}%`).join(', ')})`;
    }

    deleteSelectedPreset() {
        if (this.selectedPresetIndex === null) return;
        this.gradientPresets.splice(this.selectedPresetIndex, 1);
        // Always clear selection after delete
        this.selectedPresetIndex = null;
        this.savePresetsToStorage();
        this.renderPresets();
    }

    savePresetsToStorage() {
        try {
            localStorage.setItem('gradientPresets', JSON.stringify(this.gradientPresets));
        } catch (e) {
            console.warn('Failed to save presets:', e);
        }
    }

    loadPresetsFromStorage() {
        try {
            const data = localStorage.getItem('gradientPresets');
            if (data) {
                this.gradientPresets = JSON.parse(data);
            }
        } catch (e) {
            this.gradientPresets = [];
        }
        this.selectedPresetIndex = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GradientMapTool();
}); 