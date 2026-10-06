/**
 * ==============================================================================
 * BỘ XỬ LÝ PDF (PDF PROCESSOR)
 * 100% Pure Client-Side PDF Processing Suite in Vanilla JavaScript
 * ==============================================================================
 */

// Configure PDF.js Worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Global App State & Utilities
 */
const App = {
    currentTool: 'merge',
    activeBlob: null,
    activeFilename: 'document.pdf',

    init() {
        this.checkLibraries();
        this.initIcons();
        this.initNavigation();
        this.initPasswordToggles();
        this.initResultModal();

        // Initialize all 8 tools
        MergeTool.init();
        SplitTool.init();
        DeleteTool.init();
        RotateTool.init();
        ReorderTool.init();
        AddImageTool.init();
        CompressTool.init();
        PasswordTool.init();
    },

    initIcons() {
        try {
            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons();
            }
        } catch (e) { console.warn('lucide icons failed:', e); }
    },

    checkLibraries() {
        // FIX: báo rõ khi CDN chặn/mất mạng thay vì web chết lặng
        const missing = [];
        if (!window.PDFLib) missing.push('PDFLib (@cantoo/pdf-lib)');
        if (!window.pdfjsLib) missing.push('PDF.js');
        if (!window.JSZip) missing.push('JSZip');
        if (!window.lucide) console.warn('Lucide icons CDN chưa tải (icon có thể thiếu).');
        if (missing.length > 0) {
            console.error('Thiếu thư viện:', missing.join(', '));
            const show = () => Utils.showToast('error', 'Chưa tải được thư viện', `Không tải được: ${missing.join(', ')}. Hãy kiểm tra mạng/adblock rồi tải lại trang.`);
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
            else show();
        }
        if (window.pdfjsLib && !window.__pdfWorkerSet) {
            try {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                window.__pdfWorkerSet = true;
            } catch (e) {}
        }
    },

    initNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const toolName = tab.getAttribute('data-tool');
                this.switchTool(toolName);
            });
        });
    },

    switchTool(toolName) {
        this.currentTool = toolName;

        // Update active tab button
        document.querySelectorAll('.nav-tab').forEach(tab => {
            const isActive = tab.getAttribute('data-tool') === toolName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        // Update active panel
        document.querySelectorAll('.tool-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const targetPanel = document.getElementById(`tool-${toolName}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }

        this.initIcons();
    },

    initPasswordToggles() {
        document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (!input) return;
                
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                
                btn.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
                this.initIcons();
            });
        });
    },

    initResultModal() {
        const downloadBtn = document.getElementById('result-download-btn');
        const resetBtn = document.getElementById('result-reset-btn');
        const overlay = document.getElementById('result-overlay');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (this.activeBlob && this.activeFilename) {
                    Utils.downloadBlob(this.activeBlob, this.activeFilename);
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                overlay.classList.add('hidden');
            });
        }
    },

    showProgress(title = 'Đang xử lý tài liệu...', desc = 'Vui lòng chờ trong giây lát...') {
        const overlay = document.getElementById('process-overlay');
        const titleEl = document.getElementById('process-title');
        const descEl = document.getElementById('process-desc');
        if (!overlay) return;
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        this.updateProgress(0, 'Khởi tạo...');
        overlay.classList.remove('hidden');
    },

    updateProgress(percent, stepText) {
        const fill = document.getElementById('progress-bar-fill');
        const percentLabel = document.getElementById('progress-percent-text');
        const stepLabel = document.getElementById('progress-step-text');
        
        const rounded = Math.min(100, Math.max(0, Math.round(percent)));
        if (fill) fill.style.width = `${rounded}%`;
        if (percentLabel) percentLabel.textContent = `${rounded}%`;
        if (stepLabel && stepText) stepLabel.textContent = stepText;
    },

    hideProgress() {
        const overlay = document.getElementById('process-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    showResultModal({ title, desc, filename, blob, isZip = false, comparison = null }) {
        this.activeBlob = blob;
        this.activeFilename = filename;

        const overlay = document.getElementById('result-overlay');
        if (!overlay) return;
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('result-title', title || 'Xử lý thành công!');
        setText('result-desc', desc || 'Tài liệu của bạn đã được tạo hoàn tất.');
        setText('result-filename', filename);
        setText('result-filesize', blob ? Utils.formatBytes(blob.size) : '0 Bytes');

        // Icon for PDF vs ZIP
        const iconType = document.getElementById('result-file-icon-type');
        if (iconType) {
            iconType.setAttribute('data-lucide', isZip ? 'archive' : 'file-check');
        }

        // Comparison Box (for compress tool)
        const compBox = document.getElementById('result-comparison-box');
        const honestNote = document.getElementById('result-honest-note');

        if (compBox && comparison && comparison.originalSize) {
            compBox.classList.remove('hidden');
            setText('comp-original-size', Utils.formatBytes(comparison.originalSize));
            setText('comp-new-size', Utils.formatBytes(blob.size));
            
            const diff = comparison.originalSize - blob.size;
            const percent = Math.round((diff / comparison.originalSize) * 100);

            const badge = document.getElementById('comp-badge-save');
            if (badge) {
                if (percent > 0) {
                    badge.textContent = `-${percent}%`;
                    badge.style.backgroundColor = 'var(--success)';
                    if (honestNote) honestNote.classList.add('hidden');
                } else {
                    badge.textContent = `0%`;
                    badge.style.backgroundColor = 'var(--warning)';
                    if (honestNote) honestNote.classList.remove('hidden');
                }
            }
        } else {
            if (compBox) compBox.classList.add('hidden');
            if (honestNote) honestNote.classList.add('hidden');
        }

        this.initIcons();
        overlay.classList.remove('hidden');
    }
};


/**
 * Common Helper Utilities
 */
const Utils = {
    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },

    readFileAsArrayBuffer(file) {
        // FIX: dùng API hiện đại file.arrayBuffer() khi có (nhanh, gọn),
        // fallback FileReader cho trình duyệt cũ
        if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Lỗi khi đọc file.'));
            reader.readAsArrayBuffer(file);
        });
    },

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Lỗi khi đọc ảnh.'));
            reader.readAsDataURL(file);
        });
    },

    dataUrlToBytes(dataUrl) {
        // FIX: decode base64 thủ công, không dùng fetch(dataURL) (CSP/trình duyệt cũ chặn)
        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    },

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    },

    escapeHtml(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    isPdfFile(file) {
        if (!file) return false;
        if (file.type === 'application/pdf') return true;
        return /\.pdf$/i.test(file.name || '');
    },

    showToast(type, title, message, duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconName = type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check' : 'info';

        toast.innerHTML = `
            <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${Utils.escapeHtml(title)}</div>
                <div class="toast-message">${Utils.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
        `;

        container.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    setupDropZone(dropZoneId, fileInputId, onFilesSelected) {
        const dropZone = document.getElementById(dropZoneId);
        const fileInput = document.getElementById(fileInputId);
        if (!dropZone || !fileInput) return;
        dropZone.style.cursor = 'pointer';
        dropZone.addEventListener('click', (e) => {
            const t = e.target && e.target.closest ? e.target.closest('input[type="file"],button') : null;
            if (t) return;
            fileInput.click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt && dt.files;
            if (files && files.length > 0) {
                onFilesSelected(Array.from(files));
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                onFilesSelected(Array.from(e.target.files));
                fileInput.value = ''; // Reset input to allow selecting same file again
            }
        });
    },

    async getPdfPageCount(arrayBuffer) {
        try {
            // FIX: pdf.js có thể "detach" (neuter) buffer gốc -> clone trước khi đưa cho pdf.js
            const clone = arrayBuffer.slice(0);
            const pdf = await pdfjsLib.getDocument({ data: clone }).promise;
            const n = pdf.numPages;
            try { await pdf.destroy(); } catch (e) {}
            return n;
        } catch (e) {
            // Fallback via PDFLib
            const doc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            return doc.getPageCount();
        }
    },

    async renderPageThumbnail(pdfDoc, pageNum, canvas, targetWidth = 200) {
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });
            const scale = targetWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale: scale });

            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;

            const context = canvas.getContext('2d');
            // FIX: nền trắng để thumbnail không bị đen khi PDF có nền trong suốt
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport
            };
            await page.render(renderContext).promise;
            return true;
        } catch (err) {
            console.error(`Lỗi khi render trang ${pageNum}:`, err);
            return false;
        }
    },

    // Convert any image format (JPG, PNG, WEBP) to Image element & canvas dimensions
    loadImageElement(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Không thể nạp hình ảnh.'));
            img.src = dataUrl;
        });
    },

    // FIX: convert ảnh WebP/GIF/BMP sang PNG để pdf-lib embed được
    convertImageToPng(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || img.width;
                    c.height = img.naturalHeight || img.height;
                    const ctx = c.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, c.width, c.height);
                    ctx.drawImage(img, 0, 0);
                    resolve(c.toDataURL('image/png'));
                } catch (e) { reject(e); }
            };
            img.onerror = () => reject(new Error('convert-failed'));
            img.src = dataUrl;
        });
    }
};


/**
 * ==============================================================================
 * 1. TOOL: GHÉP PDF (MERGE PDF)
 * ==============================================================================
 */
const MergeTool = {
    files: [], // Array of { id, file, name, size, pageCount, arrayBuffer }
    dropZone: null,
    workspace: null,
    fileList: null,

    init() {
        this.dropZone = document.getElementById('merge-drop-zone');
        this.workspace = document.getElementById('merge-workspace');
        this.fileList = document.getElementById('merge-file-list');

        Utils.setupDropZone('merge-drop-zone', 'merge-file-input', (files) => this.handleFiles(files));

        document.getElementById('merge-add-more-btn').addEventListener('click', () => {
            document.getElementById('merge-file-input').click();
        });

        document.getElementById('merge-clear-all-btn').addEventListener('click', () => {
            this.files = [];
            this.updateUI();
        });

        document.getElementById('merge-process-btn').addEventListener('click', () => this.processMerge());
    },

    async handleFiles(fileList) {
        // FIX: chuẩn hoá FileList/Array + lọc đúng PDF + chống trùng file
        const arr = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
        const seen = new Set(this.files.map(f => f.name + '|' + f.size));
        const newFiles = arr.filter(f => Utils.isPdfFile(f) && !seen.has(f.name + '|' + f.size));
        
        if (newFiles.length === 0) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chỉ chọn các file có định dạng PDF (.pdf).');
            return;
        }

        App.showProgress('Đang tải tài liệu...', 'Đang phân tích các file PDF được chọn...');

        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            App.updateProgress((i / newFiles.length) * 100, `Đang đọc file: ${file.name}`);
            try {
                const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
                let pageCount = 1;
                try {
                    pageCount = await Utils.getPdfPageCount(arrayBuffer);
                } catch (pe) {
                    console.warn('Could not read page count precisely:', pe);
                }

                this.files.push({
                    id: 'file_' + Math.random().toString(36).substr(2, 9),
                    file: file,
                    name: file.name,
                    size: file.size,
                    pageCount: pageCount,
                    arrayBuffer: arrayBuffer
                });
            } catch (err) {
                Utils.showToast('error', 'Lỗi file', `Không thể đọc file: ${Utils.escapeHtml(file.name)}`);
            }
        }

        App.hideProgress();
        this.updateUI();
    },

    updateUI() {
        if (this.files.length === 0) {
            this.dropZone.classList.remove('hidden');
            this.workspace.classList.add('hidden');
            return;
        }

        this.dropZone.classList.add('hidden');
        this.workspace.classList.remove('hidden');

        document.getElementById('merge-file-count').textContent = `${this.files.length} file`;
        this.renderFileList();
    },

    renderFileList() {
        this.fileList.innerHTML = '';

        this.files.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.draggable = true;
            li.dataset.index = index;

            li.innerHTML = `
                <div class="file-item-left">
                    <span class="drag-handle" title="Kéo để đổi thứ tự"><i data-lucide="grip-vertical"></i></span>
                    <span class="file-item-num">#${index + 1}</span>
                    <div class="file-item-details">
                        <div class="file-item-name" title="${Utils.escapeHtml(item.name)}">${Utils.escapeHtml(item.name)}</div>
                        <div class="file-item-meta">${Utils.formatBytes(item.size)} • <strong>${item.pageCount}</strong> trang</div>
                    </div>
                </div>
                <div class="file-item-right">
                    <button class="btn-icon-sm" title="Di chuyển lên" onclick="MergeTool.moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>
                        <i data-lucide="arrow-up"></i>
                    </button>
                    <button class="btn-icon-sm" title="Di chuyển xuống" onclick="MergeTool.moveFile(${index}, 1)" ${index === this.files.length - 1 ? 'disabled' : ''}>
                        <i data-lucide="arrow-down"></i>
                    </button>
                    <button class="btn-icon-sm delete-btn" title="Xóa file khỏi danh sách" onclick="MergeTool.removeFile(${index})">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            // HTML5 Drag & Drop reorder
            li.addEventListener('dragstart', (e) => {
                li.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index);
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIdx = index;
                if (!isNaN(fromIdx) && fromIdx !== toIdx) {
                    MergeTool.reorderFile(fromIdx, toIdx);
                }
            });

            this.fileList.appendChild(li);
        });

        App.initIcons();
    },

    moveFile(index, delta) {
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= this.files.length) return;
        const temp = this.files[index];
        this.files[index] = this.files[newIndex];
        this.files[newIndex] = temp;
        this.renderFileList();
    },

    reorderFile(from, to) {
        const movedItem = this.files.splice(from, 1)[0];
        this.files.splice(to, 0, movedItem);
        this.renderFileList();
    },

    removeFile(index) {
        this.files.splice(index, 1);
        this.updateUI();
    },

    async processMerge() {
        if (this.files.length < 2) {
            Utils.showToast('warning', 'Cần thêm file', 'Vui lòng chọn ít nhất 2 file PDF để thực hiện ghép.');
            return;
        }

        try {
            App.showProgress('Đang ghép các file PDF...', 'Khởi tạo tài liệu mới...');
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (let i = 0; i < this.files.length; i++) {
                const item = this.files[i];
                const progressPct = ((i + 1) / this.files.length) * 80;
                App.updateProgress(progressPct, `Đang xử lý file ${i + 1}/${this.files.length}: ${item.name}`);

                const srcDoc = await PDFLib.PDFDocument.load(item.arrayBuffer, { ignoreEncryption: true });
                const pageIndices = srcDoc.getPageIndices();
                const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
                
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }

            App.updateProgress(90, 'Đang xuất bản file PDF hoàn chỉnh...');
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

            App.hideProgress();
            App.showResultModal({
                title: 'Ghép PDF Thành Công!',
                desc: `Đã kết hợp thành công ${this.files.length} file PDF thành một tài liệu duy nhất.`,
                filename: 'da_ghep_tai_lieu.pdf',
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Merge Error:', err);
            Utils.showToast('error', 'Lỗi ghép file', 'Đã xảy ra lỗi trong quá trình ghép PDF. Kiểm tra xem có file nào bị khóa mật khẩu không.');
        }
    }
};


/**
 * ==============================================================================
 * 2. TOOL: TÁCH PDF (SPLIT PDF)
 * ==============================================================================
 */
const SplitTool = {
    fileData: null, // { file, name, size, pageCount, arrayBuffer }

    init() {
        Utils.setupDropZone('split-drop-zone', 'split-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('split-change-file-btn').addEventListener('click', () => {
            this.fileData = null;
            document.getElementById('split-drop-zone').classList.remove('hidden');
            document.getElementById('split-workspace').classList.add('hidden');
        });

        // Mode change listeners
        document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateModeOptions(e.target.value);
            });
        });

        document.getElementById('split-ranges-input').addEventListener('input', (e) => {
            this.renderRangePreview(e.target.value);
        });

        document.getElementById('split-process-btn').addEventListener('click', () => this.processSplit());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang đọc file PDF...', 'Vui lòng chờ trong giây lát...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            const pageCount = await Utils.getPdfPageCount(arrayBuffer);

            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: pageCount,
                arrayBuffer: arrayBuffer.slice(0)
            };

            document.getElementById('split-filename').textContent = file.name;
            document.getElementById('split-filesize').textContent = Utils.formatBytes(file.size);
            document.getElementById('split-pagecount').textContent = pageCount;

            document.getElementById('split-drop-zone').classList.add('hidden');
            document.getElementById('split-workspace').classList.remove('hidden');

            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể mở file PDF này. File có thể bị hỏng hoặc có mật khẩu.');
        }
    },

    updateModeOptions(mode) {
        const rangesBox = document.getElementById('split-ranges-input-box');
        const extractBox = document.getElementById('split-extract-input-box');

        rangesBox.classList.toggle('hidden', mode !== 'ranges');
        extractBox.classList.toggle('hidden', mode !== 'extract');
    },

    renderRangePreview(text) {
        const container = document.getElementById('split-range-preview');
        container.innerHTML = '';
        if (!text.trim() || !this.fileData) return;

        const ranges = this.parseRangeGroups(text, this.fileData.pageCount);
        ranges.forEach((range, idx) => {
            const tag = document.createElement('span');
            tag.className = 'range-tag';
            tag.textContent = `File ${idx + 1}: Trang ${range.join(', ')}`;
            container.appendChild(tag);
        });
    },

    parseRangeGroups(rangeString, maxPages) {
        const groups = rangeString.split(',').map(s => s.trim()).filter(Boolean);
        const result = [];

        groups.forEach(group => {
            const pagesInGroup = [];
            if (group.includes('-')) {
                const parts = group.split('-').map(p => parseInt(p.trim(), 10));
                const start = Math.max(1, parts[0] || 1);
                const end = Math.min(maxPages, parts[1] || maxPages);
                if (start <= end) {
                    for (let p = start; p <= end; p++) {
                        pagesInGroup.push(p);
                    }
                }
            } else {
                const p = parseInt(group, 10);
                if (!isNaN(p) && p >= 1 && p <= maxPages) {
                    pagesInGroup.push(p);
                }
            }
            if (pagesInGroup.length > 0) {
                result.push(pagesInGroup);
            }
        });

        return result;
    },

    async processSplit() {
        if (!this.fileData) return;

        const mode = document.querySelector('input[name="split-mode"]:checked').value;
        const totalPages = this.fileData.pageCount;
        const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');

        try {
            App.showProgress('Đang tách PDF...', 'Đang khởi tạo...');
            const srcDoc = await PDFLib.PDFDocument.load(this.fileData.arrayBuffer, { ignoreEncryption: true });

            if (mode === 'all') {
                // Split every page into separate PDF -> package into ZIP
                const zip = new JSZip();

                for (let p = 0; p < totalPages; p++) {
                    App.updateProgress(((p + 1) / totalPages) * 90, `Đang tách trang ${p + 1}/${totalPages}...`);
                    const singleDoc = await PDFLib.PDFDocument.create();
                    const [copiedPage] = await singleDoc.copyPages(srcDoc, [p]);
                    singleDoc.addPage(copiedPage);

                    const pdfBytes = await singleDoc.save();
                    const padNum = String(p + 1).padStart(String(totalPages).length, '0');
                    zip.file(`${baseName}_trang_${padNum}.pdf`, pdfBytes);
                }

                App.updateProgress(95, 'Đang nén file ZIP kết quả...');
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                App.hideProgress();

                App.showResultModal({
                    title: 'Tách Trang Hoàn Tất!',
                    desc: `Đã tách thành ${totalPages} file PDF riêng lẻ và đóng gói trong file ZIP.`,
                    filename: `${baseName}_cac_trang.zip`,
                    blob: zipBlob,
                    isZip: true
                });

            } else if (mode === 'ranges') {
                const inputVal = document.getElementById('split-ranges-input').value;
                const rangeGroups = this.parseRangeGroups(inputVal, totalPages);

                if (rangeGroups.length === 0) {
                    App.hideProgress();
                    Utils.showToast('warning', 'Dải trang trống', 'Vui lòng nhập khoảng trang hợp lệ (ví dụ: 1-3, 4-8).');
                    return;
                }

                if (rangeGroups.length === 1) {
                    // Single PDF output
                    const singleDoc = await PDFLib.PDFDocument.create();
                    const zeroBasedIndices = rangeGroups[0].map(p => p - 1);
                    const copiedPages = await singleDoc.copyPages(srcDoc, zeroBasedIndices);
                    copiedPages.forEach(cp => singleDoc.addPage(cp));

                    const pdfBytes = await singleDoc.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    App.hideProgress();

                    App.showResultModal({
                        title: 'Tách Dải Trang Thành Công!',
                        desc: `Đã trích xuất các trang: ${rangeGroups[0].join(', ')}`,
                        filename: `${baseName}_tach.pdf`,
                        blob: blob
                    });
                } else {
                    // Multiple range PDFs -> ZIP
                    const zip = new JSZip();
                    for (let i = 0; i < rangeGroups.length; i++) {
                        App.updateProgress(((i + 1) / rangeGroups.length) * 90, `Đang tạo file dải ${i + 1}/${rangeGroups.length}...`);
                        const groupDoc = await PDFLib.PDFDocument.create();
                        const zeroBasedIndices = rangeGroups[i].map(p => p - 1);
                        const copiedPages = await groupDoc.copyPages(srcDoc, zeroBasedIndices);
                        copiedPages.forEach(cp => groupDoc.addPage(cp));

                        const pdfBytes = await groupDoc.save();
                        zip.file(`${baseName}_phan_${i + 1}_trang_${rangeGroups[i][0]}-${rangeGroups[i][rangeGroups[i].length - 1]}.pdf`, pdfBytes);
                    }

                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    App.hideProgress();

                    App.showResultModal({
                        title: 'Tách PDF Thành Công!',
                        desc: `Đã tạo ${rangeGroups.length} file PDF theo nhóm trang và đóng gói ZIP.`,
                        filename: `${baseName}_tach_nhom.zip`,
                        blob: zipBlob,
                        isZip: true
                    });
                }

            } else if (mode === 'extract') {
                const inputVal = document.getElementById('split-extract-input').value;
                const rangeGroups = this.parseRangeGroups(inputVal, totalPages);
                const allPages = [...new Set(rangeGroups.flat())].sort((a, b) => a - b);

                if (allPages.length === 0) {
                    App.hideProgress();
                    Utils.showToast('warning', 'Chưa chọn trang', 'Vui lòng nhập danh sách các trang muốn trích xuất.');
                    return;
                }

                const singleDoc = await PDFLib.PDFDocument.create();
                const zeroBasedIndices = allPages.map(p => p - 1);
                const copiedPages = await singleDoc.copyPages(srcDoc, zeroBasedIndices);
                copiedPages.forEach(cp => singleDoc.addPage(cp));

                const pdfBytes = await singleDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                App.hideProgress();

                App.showResultModal({
                    title: 'Trích Xuất Trang Thành Công!',
                    desc: `Đã tạo file PDF mới gồm ${allPages.length} trang đã chọn (${allPages.join(', ')}).`,
                    filename: `${baseName}_trich_xuat.pdf`,
                    blob: blob
                });
            }

        } catch (err) {
            App.hideProgress();
            console.error('Split Error:', err);
            Utils.showToast('error', 'Lỗi tách PDF', 'Đã xảy ra sự cố khi tách các trang PDF.');
        }
    }
};


/**
 * ==============================================================================
 * 3. TOOL: XÓA TRANG (DELETE PAGES)
 * ==============================================================================
 */
const DeleteTool = {
    fileData: null,
    pdfJsDoc: null,
    selectedPagesToDelete: new Set(), // Set of 1-based page numbers

    init() {
        Utils.setupDropZone('delete-drop-zone', 'delete-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('delete-select-even-btn').addEventListener('click', () => this.selectByPattern('even'));
        document.getElementById('delete-select-odd-btn').addEventListener('click', () => this.selectByPattern('odd'));
        document.getElementById('delete-select-all-btn').addEventListener('click', () => this.selectByPattern('all'));
        document.getElementById('delete-deselect-all-btn').addEventListener('click', () => this.selectByPattern('none'));

        document.getElementById('delete-process-btn').addEventListener('click', () => this.processDelete());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang tải trang PDF...', 'Đang render hình ảnh các trang...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            // FIX: pdf.js chiếm (detach) buffer gốc -> truyền bản clone, giữ gốc cho pdf-lib
            this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            
            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: this.pdfJsDoc.numPages,
                arrayBuffer: arrayBuffer
            };

            this.selectedPagesToDelete.clear();
            document.getElementById('delete-drop-zone').classList.add('hidden');
            document.getElementById('delete-workspace').classList.remove('hidden');

            document.getElementById('delete-page-summary').textContent = `Tổng cộng: ${this.fileData.pageCount} trang`;
            this.updateSelectionSummary();

            await this.renderGrid();
            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể đọc file PDF để hiển thị trang.');
        }
    },

    async renderGrid() {
        const grid = document.getElementById('delete-grid');
        grid.innerHTML = '';

        for (let pageNum = 1; pageNum <= this.fileData.pageCount; pageNum++) {
            App.updateProgress((pageNum / this.fileData.pageCount) * 100, `Đang render trang ${pageNum}/${this.fileData.pageCount}...`);

            const card = document.createElement('div');
            card.className = 'page-card delete-mode';
            card.dataset.page = pageNum;

            card.innerHTML = `
                <div class="page-canvas-wrapper">
                    <canvas id="delete-canvas-${pageNum}"></canvas>
                </div>
                <div class="page-number-tag">Trang ${pageNum}</div>
            `;

            card.addEventListener('click', () => this.togglePageSelection(pageNum, card));
            grid.appendChild(card);

            const canvas = document.getElementById(`delete-canvas-${pageNum}`);
            await Utils.renderPageThumbnail(this.pdfJsDoc, pageNum, canvas, 180);
        }
    },

    togglePageSelection(pageNum, cardElement) {
        if (this.selectedPagesToDelete.has(pageNum)) {
            this.selectedPagesToDelete.delete(pageNum);
            cardElement.classList.remove('selected-for-delete');
            const badge = cardElement.querySelector('.delete-badge-overlay');
            if (badge) badge.remove();
        } else {
            this.selectedPagesToDelete.add(pageNum);
            cardElement.classList.add('selected-for-delete');
            const badge = document.createElement('div');
            badge.className = 'delete-badge-overlay';
            badge.innerHTML = '<i data-lucide="trash-2"></i>';
            cardElement.appendChild(badge);
            App.initIcons();
        }
        this.updateSelectionSummary();
    },

    selectByPattern(pattern) {
        if (!this.fileData) return;
        const total = this.fileData.pageCount;

        for (let p = 1; p <= total; p++) {
            const card = document.querySelector(`.page-card.delete-mode[data-page="${p}"]`);
            let shouldSelect = false;

            if (pattern === 'even') shouldSelect = (p % 2 === 0);
            else if (pattern === 'odd') shouldSelect = (p % 2 !== 0);
            else if (pattern === 'all') shouldSelect = true;
            else if (pattern === 'none') shouldSelect = false;

            if (shouldSelect) {
                this.selectedPagesToDelete.add(p);
                if (card) {
                    card.classList.add('selected-for-delete');
                    if (!card.querySelector('.delete-badge-overlay')) {
                        const badge = document.createElement('div');
                        badge.className = 'delete-badge-overlay';
                        badge.innerHTML = '<i data-lucide="trash-2"></i>';
                        card.appendChild(badge);
                    }
                }
            } else {
                this.selectedPagesToDelete.delete(p);
                if (card) {
                    card.classList.remove('selected-for-delete');
                    const badge = card.querySelector('.delete-badge-overlay');
                    if (badge) badge.remove();
                }
            }
        }
        App.initIcons();
        this.updateSelectionSummary();
    },

    updateSelectionSummary() {
        const count = this.selectedPagesToDelete.size;
        const sumBadge = document.getElementById('delete-selected-summary');
        const processBtn = document.getElementById('delete-process-btn');

        if (count > 0) {
            sumBadge.textContent = `Đã chọn xóa: ${count} trang`;
            sumBadge.classList.remove('hidden');
            processBtn.disabled = false;
        } else {
            sumBadge.classList.add('hidden');
            processBtn.disabled = true;
        }
    },

    async processDelete() {
        if (!this.fileData || this.selectedPagesToDelete.size === 0) return;

        const totalPages = this.fileData.pageCount;
        if (this.selectedPagesToDelete.size >= totalPages) {
            Utils.showToast('error', 'Không thể xóa hết', 'Bạn không thể xóa toàn bộ trang. Tài liệu phải còn lại ít nhất 1 trang.');
            return;
        }

        try {
            App.showProgress('Đang xuất bản PDF mới...', 'Đang loại bỏ các trang đã chọn...');
            const srcDoc = await PDFLib.PDFDocument.load(this.fileData.arrayBuffer, { ignoreEncryption: true });
            const newDoc = await PDFLib.PDFDocument.create();

            const keepIndices = [];
            for (let p = 1; p <= totalPages; p++) {
                if (!this.selectedPagesToDelete.has(p)) {
                    keepIndices.push(p - 1);
                }
            }

            const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
            copiedPages.forEach(cp => newDoc.addPage(cp));

            const pdfBytes = await newDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Đã Xóa Trang Thành Công!',
                desc: `Đã xóa ${this.selectedPagesToDelete.size} trang. Tài liệu mới còn lại ${keepIndices.length} trang.`,
                filename: `${baseName}_da_xoa_trang.pdf`,
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Delete Page Error:', err);
            Utils.showToast('error', 'Lỗi xử lý', 'Đã xảy ra lỗi khi tạo tài liệu PDF mới.');
        }
    }
};


/**
 * ==============================================================================
 * 4. TOOL: XOAY TRANG (ROTATE PAGES)
 * ==============================================================================
 */
const RotateTool = {
    fileData: null,
    pdfJsDoc: null,
    pageRotations: {}, // Map of 1-based page number => angle (0, 90, 180, 270)

    init() {
        Utils.setupDropZone('rotate-drop-zone', 'rotate-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('rotate-all-left-btn').addEventListener('click', () => this.rotateAll(-90));
        document.getElementById('rotate-all-right-btn').addEventListener('click', () => this.rotateAll(90));
        document.getElementById('rotate-all-180-btn').addEventListener('click', () => this.rotateAll(180));
        document.getElementById('rotate-reset-btn').addEventListener('click', () => this.resetRotations());

        document.getElementById('rotate-process-btn').addEventListener('click', () => this.processRotate());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang tải trang PDF...', 'Đang nạp dữ liệu xem trước...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            // FIX: pdf.js chiếm (detach) buffer gốc -> truyền bản clone, giữ gốc cho pdf-lib
            this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            
            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: this.pdfJsDoc.numPages,
                arrayBuffer: arrayBuffer
            };

            this.pageRotations = {};
            for (let i = 1; i <= this.fileData.pageCount; i++) {
                this.pageRotations[i] = 0;
            }

            document.getElementById('rotate-drop-zone').classList.add('hidden');
            document.getElementById('rotate-workspace').classList.remove('hidden');
            document.getElementById('rotate-page-summary').textContent = `${this.fileData.pageCount} trang`;

            await this.renderGrid();
            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể đọc file PDF.');
        }
    },

    async renderGrid() {
        const grid = document.getElementById('rotate-grid');
        grid.innerHTML = '';

        for (let pageNum = 1; pageNum <= this.fileData.pageCount; pageNum++) {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.id = `rotate-card-${pageNum}`;

            card.innerHTML = `
                <div class="page-canvas-wrapper">
                    <canvas id="rotate-canvas-${pageNum}"></canvas>
                </div>
                <div class="page-number-tag">Trang ${pageNum} <span id="rotate-deg-label-${pageNum}" class="text-muted">(0°)</span></div>
                <div class="page-rotate-actions">
                    <button class="rotate-btn-mini" title="Xoay trái 90°" onclick="RotateTool.rotatePage(${pageNum}, -90)">
                        <i data-lucide="rotate-ccw"></i> -90°
                    </button>
                    <button class="rotate-btn-mini" title="Xoay phải 90°" onclick="RotateTool.rotatePage(${pageNum}, 90)">
                        <i data-lucide="rotate-cw"></i> +90°
                    </button>
                </div>
            `;

            grid.appendChild(card);
            const canvas = document.getElementById(`rotate-canvas-${pageNum}`);
            await Utils.renderPageThumbnail(this.pdfJsDoc, pageNum, canvas, 180);
        }
        App.initIcons();
    },

    rotatePage(pageNum, degDelta) {
        let current = this.pageRotations[pageNum] || 0;
        current = (current + degDelta) % 360;
        if (current < 0) current += 360;
        this.pageRotations[pageNum] = current;

        const canvas = document.getElementById(`rotate-canvas-${pageNum}`);
        const label = document.getElementById(`rotate-deg-label-${pageNum}`);
        if (canvas) {
            canvas.style.transform = `rotate(${current}deg)`;
        }
        if (label) {
            label.textContent = current === 0 ? '(0°)' : `(${current}°)`;
            label.style.color = current === 0 ? 'var(--text-muted)' : 'var(--accent-blue)';
        }
    },

    rotateAll(degDelta) {
        if (!this.fileData) return;
        for (let p = 1; p <= this.fileData.pageCount; p++) {
            this.rotatePage(p, degDelta);
        }
    },

    resetRotations() {
        if (!this.fileData) return;
        for (let p = 1; p <= this.fileData.pageCount; p++) {
            this.pageRotations[p] = 0;
            const canvas = document.getElementById(`rotate-canvas-${p}`);
            const label = document.getElementById(`rotate-deg-label-${p}`);
            if (canvas) canvas.style.transform = 'rotate(0deg)';
            if (label) {
                label.textContent = '(0°)';
                label.style.color = 'var(--text-muted)';
            }
        }
    },

    async processRotate() {
        if (!this.fileData) return;

        try {
            App.showProgress('Đang xoay các trang...', 'Đang cập nhật thuộc tính xoay trong PDF...');
            const doc = await PDFLib.PDFDocument.load(this.fileData.arrayBuffer, { ignoreEncryption: true });
            const pages = doc.getPages();

            pages.forEach((page, idx) => {
                const pageNum = idx + 1;
                const additionalRotation = this.pageRotations[pageNum] || 0;
                if (additionalRotation !== 0) {
                    const currentAngle = page.getRotation().angle;
                    const newAngle = (currentAngle + additionalRotation) % 360;
                    page.setRotation(PDFLib.degrees(newAngle));
                }
            });

            const pdfBytes = await doc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Xoay Trang Thành Công!',
                desc: 'Tài liệu PDF với góc xoay mới đã được xuất thành công.',
                filename: `${baseName}_da_xoay.pdf`,
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Rotate Error:', err);
            Utils.showToast('error', 'Lỗi xoay trang', 'Không thể áp dụng góc xoay vào tài liệu PDF.');
        }
    }
};


/**
 * ==============================================================================
 * 5. TOOL: SẮP XẾP TRANG (REORGANIZE / REORDER PAGES)
 * ==============================================================================
 */
const ReorderTool = {
    fileData: null,
    pdfJsDoc: null,
    pageOrder: [], // Array of 1-based page numbers e.g. [1, 2, 3, 4]

    init() {
        Utils.setupDropZone('reorder-drop-zone', 'reorder-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('reorder-reverse-btn').addEventListener('click', () => this.reverseOrder());
        document.getElementById('reorder-reset-btn').addEventListener('click', () => this.resetOrder());
        document.getElementById('reorder-process-btn').addEventListener('click', () => this.processReorder());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang nạp trang PDF...', 'Đang render dữ liệu...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            // FIX: pdf.js chiếm (detach) buffer gốc -> truyền bản clone, giữ gốc cho pdf-lib
            this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            
            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: this.pdfJsDoc.numPages,
                arrayBuffer: arrayBuffer
            };

            this.pageOrder = [];
            for (let i = 1; i <= this.fileData.pageCount; i++) {
                this.pageOrder.push(i);
            }

            document.getElementById('reorder-drop-zone').classList.add('hidden');
            document.getElementById('reorder-workspace').classList.remove('hidden');
            document.getElementById('reorder-page-summary').textContent = `${this.fileData.pageCount} trang`;

            await this.renderGrid();
            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể đọc file PDF.');
        }
    },

    async renderGrid() {
        const grid = document.getElementById('reorder-grid');
        grid.innerHTML = '';

        for (let i = 0; i < this.pageOrder.length; i++) {
            const originalPageNum = this.pageOrder[i];
            const card = document.createElement('div');
            card.className = 'page-card sortable-card';
            card.draggable = true;
            card.dataset.orderIndex = i;
            card.dataset.pageNum = originalPageNum;

            card.innerHTML = `
                <div class="drag-tag"><i data-lucide="grip-horizontal"></i> Vị trí ${i + 1}</div>
                <div class="page-canvas-wrapper">
                    <canvas id="reorder-canvas-${originalPageNum}"></canvas>
                </div>
                <div class="page-number-tag">Trang gốc ${originalPageNum}</div>
                <div class="reorder-btn-row">
                    <button class="btn-icon-sm" title="Lùi 1 vị trí" onclick="ReorderTool.moveCard(${i}, -1)" ${i === 0 ? 'disabled' : ''}><i data-lucide="arrow-left"></i></button>
                    <button class="btn-icon-sm" title="Tiến 1 vị trí" onclick="ReorderTool.moveCard(${i}, 1)" ${i === this.pageOrder.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-right"></i></button>
                </div>
            `;

            // HTML5 Drag & Drop handlers
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', i);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIdx = i;
                if (!isNaN(fromIdx) && fromIdx !== toIdx) {
                    const item = ReorderTool.pageOrder.splice(fromIdx, 1)[0];
                    ReorderTool.pageOrder.splice(toIdx, 0, item);
                    ReorderTool.renderGrid();
                }
            });

            grid.appendChild(card);
            const canvas = document.getElementById(`reorder-canvas-${originalPageNum}`);
            await Utils.renderPageThumbnail(this.pdfJsDoc, originalPageNum, canvas, 180);
        }
        App.initIcons();
    },

    moveCard(index, delta) {
        // FIX: nút di chuyển cho mobile / khi không kéo-thả được
        const newIndex = index + delta;
        if (newIndex < 0 || newIndex >= this.pageOrder.length) return;
        const tmp = this.pageOrder[index];
        this.pageOrder[index] = this.pageOrder[newIndex];
        this.pageOrder[newIndex] = tmp;
        this.renderGrid();
    },

    reverseOrder() {
        this.pageOrder.reverse();
        this.renderGrid();
        Utils.showToast('success', 'Đảo ngược', 'Đã đảo ngược toàn bộ thứ tự trang!');
    },

    resetOrder() {
        this.pageOrder = [];
        for (let i = 1; i <= this.fileData.pageCount; i++) {
            this.pageOrder.push(i);
        }
        this.renderGrid();
    },

    async processReorder() {
        if (!this.fileData) return;

        try {
            App.showProgress('Đang tạo PDF mới...', 'Đang sao chép các trang theo thứ tự chỉ định...');
            const srcDoc = await PDFLib.PDFDocument.load(this.fileData.arrayBuffer, { ignoreEncryption: true });
            const newDoc = await PDFLib.PDFDocument.create();

            const zeroBasedIndices = this.pageOrder.map(p => p - 1);
            const copiedPages = await newDoc.copyPages(srcDoc, zeroBasedIndices);
            copiedPages.forEach(cp => newDoc.addPage(cp));

            const pdfBytes = await newDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Sắp Xếp Hoàn Tất!',
                desc: 'Tài liệu PDF mới đã được tái cấu trúc thành công theo thứ tự của bạn.',
                filename: `${baseName}_da_sap_xep.pdf`,
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Reorder Error:', err);
            Utils.showToast('error', 'Lỗi sắp xếp', 'Không thể tạo file PDF theo thứ tự mới.');
        }
    }
};


/**
 * ==============================================================================
 * 6. TOOL: THÊM ẢNH VÀO PDF (ADD IMAGE TO PDF)
 * ==============================================================================
 */
const AddImageTool = {
    pdfData: null,
    images: [], // Array of { file, name, dataUrl, type, width, height }

    init() {
        Utils.setupDropZone('add-image-pdf-drop-zone', 'add-image-pdf-input', (files) => this.handlePdf(files[0]));
        Utils.setupDropZone('add-image-img-drop-zone', 'add-image-img-input', (files) => this.handleImages(files));

        document.getElementById('add-image-pdf-remove').addEventListener('click', () => {
            this.pdfData = null;
            document.getElementById('add-image-pdf-selected').classList.add('hidden');
            document.getElementById('add-image-pdf-content').classList.remove('hidden');
            this.checkReadyState();
        });

        // Position radio toggle
        document.querySelectorAll('input[name="image-position"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const customRow = document.getElementById('image-custom-page-row');
                customRow.classList.toggle('hidden', e.target.value !== 'custom');
            });
        });

        document.getElementById('add-image-process-btn').addEventListener('click', () => this.processAddImage());
    },

    async handlePdf(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn file PDF.');
            return;
        }

        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            const pageCount = await Utils.getPdfPageCount(arrayBuffer);

            this.pdfData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: pageCount,
                arrayBuffer: arrayBuffer.slice(0)
            };

            document.getElementById('add-image-pdf-name').textContent = file.name;
            document.getElementById('add-image-pdf-meta').textContent = `${Utils.formatBytes(file.size)} • ${pageCount} trang`;

            document.getElementById('add-image-pdf-content').classList.add('hidden');
            document.getElementById('add-image-pdf-selected').classList.remove('hidden');

            const pageNumInput = document.getElementById('image-insert-page-num');
            pageNumInput.max = pageCount;
            document.getElementById('image-max-page-label').textContent = pageCount;

            this.checkReadyState();
        } catch (err) {
            Utils.showToast('error', 'Lỗi file PDF', 'Không thể đọc file PDF.');
        }
    },

    async handleImages(fileList) {
        const arr = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
        const seen = new Set(this.images.map(i => i.name + '|' + (i.file ? i.file.size : 0)));
        const validImages = arr.filter(f => (f.type && f.type.startsWith('image/')) || /\.(jpg|jpeg|png|webp)$/i.test(f.name || ''));

        if (validImages.length === 0) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn ảnh định dạng JPG, JPEG, PNG hoặc WEBP.');
            return;
        }

        for (const file of validImages) {
            const key = file.name + '|' + file.size;
            if (seen.has(key)) continue;
            seen.add(key);
            try {
                let dataUrl = await Utils.readFileAsDataURL(file);
                const imgEl = await Utils.loadImageElement(dataUrl);
                // FIX: pdf-lib KHÔNG hỗ trợ WebP/GIF/BMP -> convert sang PNG/JPEG qua canvas
                const lowerType = String(file.type || '').toLowerCase();
                let outType = file.type || 'image/jpeg';
                if (lowerType === 'image/webp' || lowerType === 'image/gif' || lowerType === 'image/bmp' || /\.webp$/i.test(file.name || '')) {
                    try { dataUrl = await Utils.convertImageToPng(dataUrl); outType = 'image/png'; } catch (e) {}
                }
                this.images.push({
                    file: file,
                    name: file.name,
                    dataUrl: dataUrl,
                    type: outType || file.type || 'image/jpeg',
                    width: imgEl.naturalWidth,
                    height: imgEl.naturalHeight
                });
            } catch (e) {
                console.warn('Lỗi đọc ảnh:', file.name, e);
            }
        }

        this.renderImagePreviews();
        this.checkReadyState();
    },

    renderImagePreviews() {
        const container = document.getElementById('add-image-previews-container');
        const content = document.getElementById('add-image-img-content');

        if (this.images.length === 0) {
            container.classList.add('hidden');
            content.classList.remove('hidden');
            return;
        }

        content.classList.add('hidden');
        container.classList.remove('hidden');
        container.innerHTML = '';

        this.images.forEach((img, idx) => {
            const item = document.createElement('div');
            item.className = 'mini-img-item';
            item.title = `${img.name} (${img.width}x${img.height})`;

            item.innerHTML = `
                <img src="${img.dataUrl}" alt="${Utils.escapeHtml(img.name)}" loading="lazy">
                <button class="btn btn-ghost btn-xs text-danger" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border-radius:50%;width:18px;height:18px;padding:0;display:flex;align-items:center;justify-content:center;color:#fff;" onclick="AddImageTool.removeImage(${idx})">×</button>
            `;
            container.appendChild(item);
        });
    },

    removeImage(idx) {
        this.images.splice(idx, 1);
        this.renderImagePreviews();
        this.checkReadyState();
    },

    checkReadyState() {
        const workspace = document.getElementById('add-image-workspace');
        if (this.pdfData && this.images.length > 0) {
            workspace.classList.remove('hidden');
        } else {
            workspace.classList.add('hidden');
        }
    },

    async processAddImage() {
        if (!this.pdfData || this.images.length === 0) return;

        try {
            App.showProgress('Đang chèn ảnh vào PDF...', 'Đang nạp tài liệu và xử lý kích thước A4...');
            const doc = await PDFLib.PDFDocument.load(this.pdfData.arrayBuffer, { ignoreEncryption: true });

            // Standard A4 dimensions in points: 595.28 x 841.89
            const A4_WIDTH = 595.28;
            const A4_HEIGHT = 841.89;
            const PADDING = 28; // Margins

            const positionModeEl = document.querySelector('input[name="image-position"]:checked');
            const positionMode = positionModeEl ? positionModeEl.value : 'end';
            let insertIndex = doc.getPageCount(); // Default end

            if (positionMode === 'start') {
                insertIndex = 0;
            } else if (positionMode === 'custom') {
                // FIX: "chèn sau trang N" (1-based) -> index = N; clamp 0..pageCount
                const raw = document.getElementById('image-insert-page-num').value;
                let customPage = parseInt(raw, 10);
                if (isNaN(customPage)) customPage = doc.getPageCount();
                customPage = Math.max(0, Math.min(doc.getPageCount(), customPage));
                insertIndex = customPage;
            }

            for (let i = 0; i < this.images.length; i++) {
                const img = this.images[i];
                App.updateProgress(((i + 1) / this.images.length) * 80, `Đang xử lý ảnh ${i + 1}/${this.images.length}: ${img.name}`);

                // Check image type & convert WEBP if needed via canvas
                let embeddedImage;
                if (img.type === 'image/png' || img.name.toLowerCase().endsWith('.png')) {
                    const imgBytes = Utils.dataUrlToBytes(img.dataUrl);
                    embeddedImage = await doc.embedPng(imgBytes);
                } else if (img.type === 'image/jpeg' || img.type === 'image/jpg' || /\.(jpe?g)$/i.test(img.name)) {
                    const imgBytes = Utils.dataUrlToBytes(img.dataUrl);
                    embeddedImage = await doc.embedJpg(imgBytes);
                } else {
                    // Convert WEBP or other image to JPEG/PNG data URL via canvas
                    const canvas = document.createElement('canvas');
                    const imgEl = await Utils.loadImageElement(img.dataUrl);
                    canvas.width = imgEl.naturalWidth;
                    canvas.height = imgEl.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(imgEl, 0, 0);
                    const pngDataUrl = canvas.toDataURL('image/png');
                    const pngBytes = Utils.dataUrlToBytes(pngDataUrl);
                    embeddedImage = await doc.embedPng(pngBytes);
                }

                // Add A4 Page
                const page = doc.insertPage(insertIndex + i, [A4_WIDTH, A4_HEIGHT]);

                // Fit image maintaining aspect ratio
                const maxWidth = A4_WIDTH - (PADDING * 2);
                const maxHeight = A4_HEIGHT - (PADDING * 2);

                const dims = embeddedImage.scaleToFit(maxWidth, maxHeight);

                // Center on page
                const x = (A4_WIDTH - dims.width) / 2;
                const y = (A4_HEIGHT - dims.height) / 2;

                page.drawImage(embeddedImage, {
                    x: x,
                    y: y,
                    width: dims.width,
                    height: dims.height
                });
            }

            const pdfBytes = await doc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.pdfData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Thêm Ảnh Thành Công!',
                desc: `Đã chèn thành công ${this.images.length} trang ảnh vào tài liệu chuẩn A4.`,
                filename: `${baseName}_them_anh.pdf`,
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Add Image Error:', err);
            Utils.showToast('error', 'Lỗi chèn ảnh', 'Không thể chèn ảnh vào file PDF.');
        }
    }
};


/**
 * ==============================================================================
 * 7. TOOL: NÉN PDF (COMPRESS PDF)
 * ==============================================================================
 */
const CompressTool = {
    fileData: null,
    pdfJsDoc: null,

    init() {
        Utils.setupDropZone('compress-drop-zone', 'compress-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('compress-change-file-btn').addEventListener('click', () => {
            this.fileData = null;
            document.getElementById('compress-drop-zone').classList.remove('hidden');
            document.getElementById('compress-workspace').classList.add('hidden');
        });

        document.getElementById('compress-process-btn').addEventListener('click', () => this.processCompress());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang đọc file PDF...', 'Đang nạp tài liệu...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            // FIX: pdf.js chiếm (detach) buffer gốc -> truyền bản clone, giữ gốc cho pdf-lib
            this.pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: this.pdfJsDoc.numPages,
                arrayBuffer: arrayBuffer
            };

            document.getElementById('compress-filename').textContent = file.name;
            document.getElementById('compress-original-size').textContent = Utils.formatBytes(file.size);
            document.getElementById('compress-pagecount').textContent = `${this.fileData.pageCount} trang`;

            document.getElementById('compress-drop-zone').classList.add('hidden');
            document.getElementById('compress-workspace').classList.remove('hidden');

            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể đọc file PDF.');
        }
    },

    async processCompress() {
        if (!this.fileData) return;

        const level = document.querySelector('input[name="compress-level"]:checked').value;
        
        // Compression settings
        let scale = 1.3;
        let quality = 0.78;

        if (level === 'light') {
            scale = 1.5;
            quality = 0.85;
        } else if (level === 'medium') {
            scale = 1.2;
            quality = 0.68;
        } else if (level === 'strong') {
            scale = 0.9;
            quality = 0.50;
        }

        try {
            App.showProgress('Đang nén file PDF...', 'Đang tối ưu từng trang...');
            const newDoc = await PDFLib.PDFDocument.create();
            const totalPages = this.fileData.pageCount;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                App.updateProgress(((pageNum) / totalPages) * 90, `Đang nén trang ${pageNum}/${totalPages}...`);

                const page = await this.pdfJsDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });
                const originalViewport = page.getViewport({ scale: 1 });

                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');

                await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                // Export JPEG with specified quality
                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegBytes = Utils.dataUrlToBytes(jpegDataUrl);

                const embeddedImage = await newDoc.embedJpg(jpegBytes);
                const newPage = newDoc.addPage([originalViewport.width, originalViewport.height]);

                newPage.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: originalViewport.width,
                    height: originalViewport.height
                });
            }

            const pdfBytes = await newDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Nén PDF Thành Công!',
                desc: 'Tài liệu đã được tối ưu hóa dung lượng.',
                filename: `${baseName}_da_nen.pdf`,
                blob: blob,
                comparison: {
                    originalSize: this.fileData.size
                }
            });
        } catch (err) {
            App.hideProgress();
            console.error('Compress Error:', err);
            Utils.showToast('error', 'Lỗi nén PDF', 'Đã xảy ra sự cố khi nén tài liệu.');
        }
    }
};


/**
 * ==============================================================================
 * 8. TOOL: ĐẶT MẬT KHẨU PDF (PASSWORD PROTECT / ENCRYPT)
 * ==============================================================================
 */
const PasswordTool = {
    fileData: null,

    init() {
        Utils.setupDropZone('password-drop-zone', 'password-file-input', (files) => this.handleFile(files[0]));

        document.getElementById('password-change-file-btn').addEventListener('click', () => {
            this.fileData = null;
            document.getElementById('password-drop-zone').classList.remove('hidden');
            document.getElementById('password-workspace').classList.add('hidden');
        });

        // Password strength listener
        document.getElementById('pdf-user-password').addEventListener('input', (e) => {
            this.checkStrength(e.target.value);
        });

        document.getElementById('pdf-confirm-password').addEventListener('input', () => {
            this.checkMatch();
        });

        document.getElementById('password-process-btn').addEventListener('click', () => this.processPassword());
    },

    async handleFile(file) {
        if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
            Utils.showToast('warning', 'Không hợp lệ', 'Vui lòng chọn 1 file PDF.');
            return;
        }

        App.showProgress('Đang đọc file PDF...', 'Vui lòng chờ...');
        try {
            const arrayBuffer = await Utils.readFileAsArrayBuffer(file);
            const pageCount = await Utils.getPdfPageCount(arrayBuffer);

            this.fileData = {
                file: file,
                name: file.name,
                size: file.size,
                pageCount: pageCount,
                arrayBuffer: arrayBuffer
            };

            document.getElementById('password-filename').textContent = file.name;
            document.getElementById('password-filesize').textContent = Utils.formatBytes(file.size);
            document.getElementById('password-pagecount').textContent = `${pageCount} trang`;

            document.getElementById('password-drop-zone').classList.add('hidden');
            document.getElementById('password-workspace').classList.remove('hidden');

            App.hideProgress();
        } catch (err) {
            App.hideProgress();
            Utils.showToast('error', 'Lỗi nạp file', 'Không thể nạp file PDF.');
        }
    },

    checkStrength(pwd) {
        const fill = document.getElementById('pwd-strength-fill');
        const text = document.getElementById('pwd-strength-text');
        if (!pwd) {
            fill.style.width = '0%';
            text.textContent = 'Độ mạnh mật khẩu';
            return;
        }

        let score = 0;
        if (pwd.length >= 6) score += 1;
        if (pwd.length >= 10) score += 1;
        if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd)) score += 1;
        if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

        if (score <= 2) {
            fill.style.width = '33%';
            fill.style.backgroundColor = 'var(--danger)';
            text.textContent = 'Độ mạnh: Yếu';
            text.style.color = 'var(--danger)';
        } else if (score <= 4) {
            fill.style.width = '66%';
            fill.style.backgroundColor = 'var(--warning)';
            text.textContent = 'Độ mạnh: Trung bình';
            text.style.color = 'var(--warning)';
        } else {
            fill.style.width = '100%';
            fill.style.backgroundColor = 'var(--success)';
            text.textContent = 'Độ mạnh: Rất an toàn';
            text.style.color = 'var(--success)';
        }
    },

    checkMatch() {
        const p1 = document.getElementById('pdf-user-password').value;
        const p2 = document.getElementById('pdf-confirm-password').value;
        const errorEl = document.getElementById('pwd-match-error');

        if (p2 && p1 !== p2) {
            errorEl.classList.remove('hidden');
            return false;
        } else {
            errorEl.classList.add('hidden');
            return true;
        }
    },

    async processPassword() {
        if (!this.fileData) return;

        const password = document.getElementById('pdf-user-password').value;
        const confirm = document.getElementById('pdf-confirm-password').value;

        if (!password) {
            Utils.showToast('warning', 'Mật khẩu trống', 'Vui lòng nhập mật khẩu muốn thiết lập.');
            document.getElementById('pdf-user-password').focus();
            return;
        }

        if (password !== confirm) {
            Utils.showToast('error', 'Không khớp', 'Xác nhận mật khẩu không trùng khớp!');
            document.getElementById('pdf-confirm-password').focus();
            return;
        }

        try {
            App.showProgress('Đang mã hóa PDF...', 'Đang áp dụng thuật toán bảo vệ AES...');
            const doc = await PDFLib.PDFDocument.load(this.fileData.arrayBuffer.slice(0), { ignoreEncryption: true });

            App.updateProgress(60, 'Đang thiết lập khóa bảo mật...');

            // FIX: kiểm tra thư viện có hỗ trợ mã hoá thật không.
            // pdf-lib gốc KHÔNG mã hoá; @cantoo/pdf-lib mới hỗ trợ.
            // Nếu save() lặng lẽ bỏ qua password -> file xuất ra KHÔNG khoá -> phải báo rõ cho user.
            let pdfBytes = null;
            let encryptedOk = false;
            const saveAttempts = [
                { userPassword: password, ownerPassword: password },
                { userPassword: password, ownerPassword: password, useObjectStreams: false }
            ];
            let lastErr = null;
            for (const opts of saveAttempts) {
                try {
                    pdfBytes = await doc.save(opts);
                    // Heuristic: file mã hoá thật chứa /Encrypt trong raw bytes
                    const head = pdfBytes.slice(0, Math.min(pdfBytes.length, 4000));
                    let text = '';
                    for (let i = 0; i < head.length; i++) text += String.fromCharCode(head[i]);
                    if (text.indexOf('/Encrypt') !== -1) { encryptedOk = true; break; }
                    // Thử kiểm tra sâu hơn ở cuối file (Encrypt dict thường nằm trailer)
                    const tail = pdfBytes.slice(Math.max(0, pdfBytes.length - 8000));
                    let tailText = '';
                    for (let i = 0; i < tail.length; i++) tailText += String.fromCharCode(tail[i]);
                    if (tailText.indexOf('/Encrypt') !== -1) { encryptedOk = true; break; }
                    lastErr = new Error('not-encrypted');
                } catch (e) { lastErr = e; }
            }
            if (!pdfBytes) throw lastErr || new Error('encrypt-failed');
            if (!encryptedOk) {
                App.hideProgress();
                Utils.showToast('error', 'Thư viện chưa hỗ trợ mã hoá', 'Phiên bản pdf-lib đang dùng không tạo được PDF khoá thật (file xuất ra sẽ KHÔNG có mật khẩu). Vui lòng cập nhật @cantoo/pdf-lib bản hỗ trợ encryption rồi thử lại.');
                return;
            }

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            App.hideProgress();

            const baseName = this.fileData.name.replace(/\.[^/.]+$/, '');
            App.showResultModal({
                title: 'Đặt Mật Khẩu Thành Công!',
                desc: 'File PDF đã được mã hóa bảo vệ. Người mở file sẽ cần nhập đúng mật khẩu vừa tạo.',
                filename: `${baseName}_bao_ve.pdf`,
                blob: blob
            });
        } catch (err) {
            App.hideProgress();
            console.error('Password Protect Error:', err);
            Utils.showToast('error', 'Lỗi mã hóa', 'Không thể mã hóa file PDF.');
        }
    }
};


// Run on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// FIX: expose tools cho inline onclick trong HTML (Merge/Rotate/Reorder dùng onclick="...Tool....")
window.MergeTool = MergeTool;
window.RotateTool = RotateTool;
window.ReorderTool = ReorderTool;
window.App = App;
window.Utils = Utils;

