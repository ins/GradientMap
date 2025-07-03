class GradientMapTool {
    constructor() {
        this.originalCanvas = null;
        this.processedCanvas = null;
        this.originalImage = null;
        this.gradientStops = [];
        this.copyTimeout = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadFromURL();
    }

    initializeElements() {
        this.colorInput = document.getElementById('colorInput');
        this.gradientPreview = document.getElementById('gradientPreview');
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.imageContainer = document.getElementById('imageContainer');
        this.saveBtn = document.getElementById('saveBtn');
        this.copyBtn = document.getElementById('copyBtn');
    }

    setupEventListeners() {
        this.colorInput.addEventListener('input', () => this.updateGradient());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.saveBtn.addEventListener('click', () => this.saveImage());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+V or Cmd+V when not focused on input
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement !== this.colorInput) {
                e.preventDefault();
                this.handlePaste();
            }
        });
    }

    async handlePaste() {
        try {
            // Try the modern clipboard API first, but silently fall back if it fails
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
            // Silently handle clipboard access issues
            console.log('Clipboard API not available or no image in clipboard');
        }
        
        // Fallback: Create a paste area for manual paste operation
        this.createPasteArea();
    }

    createPasteArea() {
        // Create a temporary contenteditable div to capture paste events
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
            
            // Clean up
            document.body.removeChild(pasteDiv);
        };
        
        pasteDiv.addEventListener('paste', handlePasteEvent);
        
        // Clean up after a short delay if no paste occurs
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
            this.createCanvas();
            this.applyGradientMap();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    setupDragAndDrop() {
        const dropZones = [this.uploadArea, this.imageContainer];
        
        dropZones.forEach(zone => {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                zone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                zone.addEventListener(eventName, () => {
                    if (zone === this.uploadArea) {
                        zone.classList.add('dragover');
                    }
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                zone.addEventListener(eventName, () => {
                    if (zone === this.uploadArea) {
                        zone.classList.remove('dragover');
                    }
                });
            });

            zone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        });
    }

    parseColorInput(input) {
        const colors = input.split(/[,\s]+/).filter(c => c.trim());
        const stops = [];
        
        colors.forEach((color, index) => {
            let hexColor = color.trim().toUpperCase();
            let position = null;
            
            // Check for custom position
            if (hexColor.includes('-')) {
                const parts = hexColor.split('-');
                hexColor = parts[0];
                position = parseInt(parts[1]) / 100;
            }
            
            // Add # if missing
            if (!hexColor.startsWith('#')) {
                hexColor = '#' + hexColor;
            }
            
            // Validate hex color
            if (/^#[0-9A-F]{6}$/i.test(hexColor)) {
                if (position === null) {
                    position = colors.length > 1 ? index / (colors.length - 1) : 0;
                }
                stops.push({ color: hexColor, position: Math.max(0, Math.min(1, position)) });
            }
        });
        
        // Sort by position
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
                this.createCanvas();
                this.applyGradientMap();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    createCanvas() {
        // Hide upload area and show image container
        this.uploadArea.style.display = 'none';
        this.imageContainer.style.display = 'flex';
        
        // Create processed canvas
        this.processedCanvas = document.createElement('canvas');
        this.processedCanvas.width = this.originalImage.width;
        this.processedCanvas.height = this.originalImage.height;
        
        // Make canvas clickable to change image
        this.processedCanvas.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // Create original canvas for processing (hidden)
        this.originalCanvas = document.createElement('canvas');
        this.originalCanvas.width = this.originalImage.width;
        this.originalCanvas.height = this.originalImage.height;
        
        const originalCtx = this.originalCanvas.getContext('2d');
        originalCtx.drawImage(this.originalImage, 0, 0);
        
        // Clear and add processed canvas
        this.imageContainer.innerHTML = '';
        this.imageContainer.appendChild(this.processedCanvas);
        
        // Add context menu for right-click save
        this.processedCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.saveImage();
        });
    }

    applyGradientMap() {
        if (!this.originalImage || !this.processedCanvas || this.gradientStops.length === 0) {
            return;
        }
        
        const ctx = this.processedCanvas.getContext('2d');
        const originalCtx = this.originalCanvas.getContext('2d');
        
        // Get original image data
        const imageData = originalCtx.getImageData(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        const data = imageData.data;
        
        // Create gradient lookup table
        const gradientLUT = this.createGradientLUT();
        
        // Apply gradient map
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate luminance
            const luminance = Math.round((0.299 * r + 0.587 * g + 0.114 * b));
            
            // Get gradient color
            const gradientColor = gradientLUT[luminance];
            
            data[i] = gradientColor.r;
            data[i + 1] = gradientColor.g;
            data[i + 2] = gradientColor.b;
            // Alpha remains unchanged
        }
        
        // Draw processed image
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
        
        // Find the two stops to interpolate between
        let leftStop = this.gradientStops[0];
        let rightStop = this.gradientStops[this.gradientStops.length - 1];
        
        for (let i = 0; i < this.gradientStops.length - 1; i++) {
            if (position >= this.gradientStops[i].position && position <= this.gradientStops[i + 1].position) {
                leftStop = this.gradientStops[i];
                rightStop = this.gradientStops[i + 1];
                break;
            }
        }
        
        // Interpolate between the two stops
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
        if (!this.processedCanvas) return;
        
        this.processedCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'gradient-mapped-image.png';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    copyToClipboard() {
        if (!this.processedCanvas) return;
        
        const originalText = this.copyBtn.textContent;
        
        this.processedCanvas.toBlob(async (blob) => {
            try {
                // Try modern clipboard API first
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                this.copyBtn.textContent = 'Copied!';
            } catch (err) {
                // Fallback for browsers that don't support clipboard write
                console.log('Clipboard write not supported, creating download instead');
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
        // Use hash-based URL to work in all contexts including artifacts
        const colors = encodeURIComponent(this.colorInput.value);
        if (typeof window !== 'undefined' && window.location) {
            window.location.hash = `colors=${colors}`;
        }
    }

    loadFromURL() {
        try {
            // Try to load from hash first (works in artifacts)
            if (window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.slice(1));
                const colors = hashParams.get('colors');
                if (colors) {
                    this.colorInput.value = decodeURIComponent(colors);
                    this.updateGradient();
                    return;
                }
            }
            
            // Fall back to search params (works when hosted normally)
            const params = new URLSearchParams(window.location.search);
            const colors = params.get('colors');
            if (colors) {
                this.colorInput.value = decodeURIComponent(colors);
            }
        } catch (e) {
            console.log('URL loading not available in this context');
        }
        
        this.updateGradient();
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GradientMapTool();
}); 