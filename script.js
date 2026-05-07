let dbKaryawan = {};
let activeQueue = []; 
let dockStatus = { 1: "---", 2: "---", 3: "---", 4: "---", 5: "---", 6: "---" };
let queueData = {
    1: { current: 0, max: 30, prefix: "1-", unload: "10:00 - 13:00" },
    2: { current: 0, max: 30, prefix: "2-", unload: "13:00 - 16:00" },
    3: { current: 0, max: 30, prefix: "3-", unload: "16:00 - 19:00" }
};

const MAX_KUOTA = { 'Istirahat': 1, 'Solat': 2, 'Toilet': 3 };
const MAX_WAKTU = { 'Istirahat': 70, 'Solat': 15, 'Toilet': 15 };
const video = document.getElementById('video');

// 1. FUNGSI SIDEBAR TOGGLE
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('hide');
}

// 2. RESET JATAH OTOMATIS (CEK TANGGAL)
function checkDailyReset() {
    const lastDate = localStorage.getItem('lastResetDate');
    const today = new Date().toLocaleDateString();
    if (lastDate !== today) {
        localStorage.setItem('userStats', JSON.stringify({})); // Reset jatah
        localStorage.setItem('lastResetDate', today);
    }
}
checkDailyReset();

// 3. JAM & TOLERANSI SLOT 10 MENIT
function updateClock() {
    const now = new Date();
    document.getElementById('clock-display').innerText = now.toLocaleTimeString('id-ID') + " WIB";
    
    const h = now.getHours();
    const m = now.getMinutes();
    const timeVal = h * 60 + m;
    const tol = 10; // Toleransi 10 menit

    toggleSlot(1, timeVal >= 540 && timeVal < (660 + tol));
    toggleSlot(2, timeVal >= 660 && timeVal < (840 + tol));
    toggleSlot(3, timeVal >= 840 && timeVal < (1020 + tol));
}
setInterval(updateClock, 1000);

function toggleSlot(slotId, isActive) {
    const btn = document.getElementById(`btn-print-${slotId}`);
    const card = document.getElementById(`slot-card-${slotId}`);
    if (btn && card) {
        btn.disabled = !isActive;
        isActive ? btn.classList.remove('btn-disabled') : btn.classList.add('btn-disabled');
        isActive ? card.classList.add('active') : card.classList.remove('active');
    }
}

// 4. LOGIKA ABSENSI BERURUTAN (IN-OUT)
function prosesAbsen(tipe, aksi) {
    const nik = document.getElementById('nik').value.trim();
    const nama = document.getElementById('nama').value.trim();
    if(!nik || !nama) return alert("Isi NIK dan Nama!");

    let userStats = JSON.parse(localStorage.getItem('userStats')) || {};
    if(!userStats[nik]) userStats[nik] = { count: {Istirahat:0, Solat:0, Toilet:0}, status: {}, lastOut:{} };

    const sekarang = new Date();
    const lastStatus = userStats[nik].status[tipe] || 'IN'; // default status di dalam

    // Validasi urutan
    if (aksi === 'OUT' && lastStatus === 'OUT') return alert(`Anda sudah OUT ${tipe}!`);
    if (aksi === 'IN' && lastStatus === 'IN') return alert(`Anda belum OUT ${tipe}!`);

    let statusTeks = "Tepat Waktu"; let isTelat = false;

    if(aksi === 'OUT') {
        if(userStats[nik].count[tipe] >= MAX_KUOTA[tipe]) return alert(`Jatah ${tipe} Habis!`);
        userStats[nik].count[tipe]++;
        userStats[nik].lastOut[tipe] = sekarang.getTime();
        userStats[nik].status[tipe] = 'OUT';
    } else {
        const t_out = userStats[nik].lastOut[tipe];
        const diff = Math.floor((sekarang.getTime() - t_out) / 60000);
        if(diff > MAX_WAKTU[tipe]) { isTelat = true; statusTeks = `Telat ${diff} mnt`; }
        userStats[nik].status[tipe] = 'IN';
    }
    
    localStorage.setItem('userStats', JSON.stringify(userStats));

    const canvas = document.getElementById('canvas');
    canvas.width = 200; canvas.height = 150;
    canvas.getContext('2d').drawImage(video, 0, 0, 200, 150);
    const imgData = canvas.toDataURL('image/jpeg', 0.5);

    let logs = JSON.parse(localStorage.getItem('logAbsen')) || [];
    logs.push({ nik, nama, aksi, tipe, jam: sekarang.toLocaleTimeString('id-ID'), status: statusTeks, isTelat, foto: imgData });
    localStorage.setItem('logAbsen', JSON.stringify(logs));
    
    alert(`✅ Berhasil ${aksi} ${tipe}`);
    document.getElementById('nik').value = ""; document.getElementById('nama').value = "";
}

// 5. SINKRONISASI PANGGILAN DOCK
function callNext(dockId) {
    if (activeQueue.length === 0) return alert("Antrian Kosong!");
    const nextNum = activeQueue.shift(); 
    dockStatus[dockId] = nextNum; 
    
    document.getElementById(`op-dock-${dockId}`).innerText = nextNum; 
    playCallSequence(nextNum, dockId);
}

// 6. DOWNLOAD EXCEL DENGAN FOTO MUNCUL
function downloadExcelDenganFoto() {
    const logs = JSON.parse(localStorage.getItem('logAbsen')) || [];
    if(logs.length === 0) return alert("Data Kosong!");

    let html = `<html><head><meta charset="UTF-8"></head><body><table border="1">
    <tr style="background:#1e293b; color:white;">
    <th>Jam</th><th>NIK</th><th>Nama</th><th>Aksi</th><th>Tipe</th><th>Status</th><th>Foto</th></tr>`;
    
    logs.reverse().forEach(l => {
        html += `<tr><td>${l.jam}</td><td>${l.nik}</td><td>${l.nama}</td><td>${l.aksi}</td><td>${l.tipe}</td><td>${l.status}</td>
        <td style="height:100px; width:120px; text-align:center;"><img src="${l.foto}" width="100" height="75"></td></tr>`;
    });
    
    const blob = new Blob([html + '</table></body></html>'], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Laporan_Astro_Sentul.xls`;
    a.click();
}

// --- FUNGSI PENDUKUNG TETAP (Navigasi, TV, UI) ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.menu li').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const map = { 'tab-absen':'m-absen', 'tab-kiosk':'m-kiosk', 'tab-operator':'m-operator', 'tab-tv':'m-tv', 'tab-report':'m-report' };
    document.getElementById(map[tabId]).classList.add('active');
    if (tabId === 'tab-absen') {
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => video.srcObject = s);
    } else {
        if(video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    }
    if(tabId === 'tab-report') tampilkanTabelLaporan();
    updateDashboardTV();
}

function updateDashboardTV() {
    document.getElementById('stat-total').innerText = queueData[1].current + queueData[2].current + queueData[3].current;
    document.getElementById('stat-remaining').innerText = activeQueue.length;
    const container = document.getElementById('tv-dock-list');
    container.innerHTML = '';
    for(let i=1; i<=6; i++) {
        container.innerHTML += `<div class="mini-dock"><h4>DOCK ${i}</h4><div class="num">${dockStatus[i]}</div></div>`;
    }
}

function playCallSequence(num, dockId) {
    document.getElementById('tv-big-num').innerText = num;
    document.getElementById('tv-big-dock').innerText = "SILAKAN KE DOCK " + dockId;
    updateDashboardTV();

    const bel = document.getElementById('bel-kereta');
    
    // PENTING: Bersihkan antrian suara sebelumnya agar tidak nyangkut/telat
    window.speechSynthesis.cancel(); 

    bel.pause(); 
    bel.currentTime = 0;
    
    bel.play().then(() => {
        // Suara akan dimainkan SETELAH bel selesai
        bel.onended = () => {
            // Ubah format angka agar dibaca jelas. Contoh "2-01" jadi "2 kosong 1"
            let angkaJelas = num.replace('-', ' kosong ');
            
            const speech = new SpeechSynthesisUtterance(`Nomor antrian, ${angkaJelas}, silakan menuju loading dock ${dockId}`);
            speech.lang = 'id-ID'; 
            speech.rate = 0.7; // Diperlambat ke 0.7 agar intonasinya jelas
            window.speechSynthesis.speak(speech);
        };
    }).catch(() => {
        // Jika bel gagal diputar, langsung panggil suaranya
        let angkaJelas = num.replace('-', ' kosong ');
        const speech = new SpeechSynthesisUtterance(`Nomor antrian, ${angkaJelas}, silakan menuju loading dock ${dockId}`);
        speech.lang = 'id-ID'; 
        speech.rate = 0.7;
        window.speechSynthesis.speak(speech);
    });
}

function generateTicket(slotId) {
    const slot = queueData[slotId];
    if (slot.current >= slot.max) return alert("Penuh!");
    slot.current++;
    const fullNum = slot.prefix + slot.current.toString().padStart(2, '0');
    activeQueue.push(fullNum);
    document.getElementById('print-queue-num').innerText = fullNum;
    document.getElementById('print-time').innerText = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('print-est-time').innerText = slot.unload;
    document.getElementById('print-current-now').innerText = document.getElementById('tv-big-num').innerText;
    window.print();
    updateDashboardTV();
}

function initOperatorPanel() {
    const container = document.getElementById('operator-docks');
    if(!container) return;
    container.innerHTML = '';
    for(let i=1; i<=6; i++) {
        container.innerHTML += `
            <div class="dock-control">
                <h3>DOCK ${i}</h3>
                <div class="dock-num" id="op-dock-${i}">${dockStatus[i]}</div>
                <button class="btn btn-green" style="width:100%; margin-bottom:10px;" onclick="callNext(${i})">PANGGIL BERIKUTNYA</button>
                <button class="btn btn-blue" style="width:100%;" onclick="recall(${i})"><i class="fa-solid fa-volume-high"></i> PANGGIL ULANG</button>
            </div>`;
    }
}

function recall(dockId) {
    const num = dockStatus[dockId];
    if (num !== "---") playCallSequence(num, dockId);
}

function bacaCSV(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        e.target.result.split('\n').forEach(line => {
            const [nik, nama] = line.split(',');
            if(nik && nama) dbKaryawan[nik.trim()] = nama.trim();
        });
        alert("✅ Data Dimuat!");
    };
    reader.readAsText(event.target.files[0]);
}

function tampilkanTabelLaporan() {
    const logs = JSON.parse(localStorage.getItem('logAbsen')) || [];
    document.getElementById('tabel-body').innerHTML = logs.reverse().map(l => `
        <tr class="${l.isTelat ? 'telat-merah' : ''}"><td>${l.nik}</td><td>${l.nama}</td><td>${l.aksi}</td><td>${l.tipe}</td><td>${l.jam}</td><td>${l.status}</td></tr>
    `).join('');
}

function hapusSemuaData() {
    if(confirm("Hapus Rekapan?")) { localStorage.removeItem('logAbsen'); tampilkanTabelLaporan(); }
}

initOperatorPanel();
updateDashboardTV();