// TEST TỰ ĐỘNG: kiểm tra tĩnh toàn bộ 8 tính năng web PDF (chạy bằng Node, không cần trình duyệt)
// Cách chạy: node test.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, hint = '') {
  if (cond) { pass++; console.log(`PASS: ${name}`); }
  else { fail++; console.log(`FAIL: ${name}${hint ? ' -> ' + hint : ''}`); }
}

// 1. Cú pháp JS đã check bằng node --check trước khi chạy test này
check('script.js tồn tại & > 10KB', js.length > 10000);
check('index.html tồn tại & > 10KB', html.length > 10000);
check('style.css tồn tại & > 5KB', css.length > 5000);

// 2. Đủ 8 tool panel + 8 tab
const tools = ['merge','split','delete','rotate','reorder','add-image','compress','password'];
tools.forEach(t => {
  check(`HTML có panel tool-${t}`, html.includes(`id="tool-${t}"`));
  check(`HTML có tab data-tool="${t}"`, html.includes(`data-tool="${t}"`));
  check(`JS có init ${t}`, js.includes(`${t}-drop-zone`) || js.includes('add-image-pdf-drop-zone'));
});

// 3. ID: mọi getElementById trong JS (tool scope) phải có trong HTML hoặc được tạo động (canvas-, rotate-deg-, result-, progress-, comp-, pwd-)
const idsInJs = [...new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
const dynamicPrefixes = ['merge-canvas-', 'rotate-canvas-', 'reorder-canvas-', 'delete-canvas-', 'rotate-deg-label-'];
idsInJs.forEach(id => {
  if (dynamicPrefixes.some(p => id.startsWith(p))) return;
  if (id.startsWith('merge-canvas') || id.startsWith('reorder-canvas') || id.startsWith('rotate-canvas') || id.startsWith('delete-canvas')) return;
  check(`ID "${id}" có trong HTML`, html.includes(`id="${id}"`), 'thiếu id trong index.html');
});

// 4. Không còn icon lucide cũ
['upload-cloud','check-circle-2','file-check-2','alert-circle'].forEach(icon => {
  check(`Không còn icon cũ ${icon}`, !html.includes(`data-lucide="${icon}"`) && !js.includes(`"${icon}"`) && !js.includes(`'${icon}'`));
});

// 5. Không còn fetch(dataURL) — CSP/adblock dễ chặn
check('Không fetch(dataURL) cho ảnh', !/fetch\(\s*(img|png|jpeg|pngDataUrl|jpegDataUrl|dataUrl)/.test(js));

// 6. Clone buffer trước khi đưa cho pdf.js (tránh detach)
const cloneCount = (js.match(/\.slice\(0\)/g) || []).length;
check('Clone ArrayBuffer trước pdf.js (>=6 điểm)', cloneCount >= 6, `mới ${cloneCount}`);

// 7. XSS: tên file render ra HTML phải escape
check('Có hàm escapeHtml', js.includes('escapeHtml('));
check('Tên file merge đã escape', js.includes('Utils.escapeHtml(item.name)'));
check('Toast đã escape', js.includes('Utils.escapeHtml(title)'));

// 8. Inline onclick tools phải global
['window.MergeTool','window.RotateTool','window.ReorderTool'].forEach(w => check(`${w} exposed`, js.includes(w)));

// 9. Reorder có nút mobile
check('Reorder có moveCard', js.includes('moveCard(index, delta)'));
check('CSS có .reorder-btn-row', css.includes('.reorder-btn-row'));

// 10. Password: không mã hoá giả — phải kiểm tra /Encrypt
check('Password kiểm tra /Encrypt', js.includes('/Encrypt') && js.includes('encryptedOk'));

// 11. Image: convert WEBP + dataUrlToBytes thủ công
check('Có convertImageToPng', js.includes('convertImageToPng'));
check('Có dataUrlToBytes thủ công (atob)', js.includes('dataUrlToBytes') && js.includes('atob('));

// 12. Drop-zone: chống double-fire + reset input + Array.from
check('Drop-zone reset input', js.includes("fileInput.value = ''"));
check('Drop-zone Array.from(files)', js.includes('Array.from(e.target.files)') && js.includes('Array.from(files)'));
check('Drop-zone chặn bubble button', js.includes('input[type="file"],button'));

// 13. Thumbnail nền trắng (không đen)
check('Thumbnail fill nền trắng', js.includes("fillStyle = '#ffffff'"));

// 14. CDN cần thiết
['@cantoo/pdf-lib','pdf.min.js','jszip','lucide'].forEach(cdn => check(`HTML nạp ${cdn}`, html.includes(cdn)));
check('JS báo lỗi khi thiếu CDN', js.includes('checkLibraries'));

console.log(`\n=== KẾT QUẢ: ${pass} PASS, ${fail} FAIL ===`);
process.exit(fail > 0 ? 1 : 0);
