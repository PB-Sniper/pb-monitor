// ==UserScript==
// @name         P-Bandai Stock Monitor V6.1
// @namespace    https://github.com/
// @version      6.1
// @description  P-Bandai 終極補貨監控：全自動 F5 刷新頁面，每 30 秒視覺掃描，有貨即鎖定及 Telegram 通知
// @author       一柿 (Presented by 一柿)
// @match        https://p-bandai.com/hk/item/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // ⚙️ 使用者設定區 (USER CONFIG)
    // ==========================================
    
    // Telegram Bot Token (如果放上 Public GitHub，建議先清空，安裝後再填)
    const TG_TOKEN = "8744700068:AAG5q3FS3ST78U0j1D4LZhej9DBvmHb0t_E";
    
    // Telegram Chat ID
    const TG_CHAT_ID = "696084464";

    // ⚡ 檢查頻率 (毫秒)：25,000 到 35,000 之間隨機 (約 30 秒)
    const MIN_INTERVAL = 25000;  
    const MAX_INTERVAL = 35000; 
    
    // ==========================================
    // 🛡️ 核心邏輯區 (CORE LOGIC)
    // ==========================================

    let reloadTimer = null;
    let isMonitoring = localStorage.getItem('pbm_v6_monitoring') === 'true';

    function sendTelegramAlert(message) {
        if (!TG_TOKEN) return;
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        const body = { chat_id: TG_CHAT_ID, text: message, parse_mode: 'HTML' };
        fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(body) 
        }).catch(err => console.error("[PB-Monitor] Telegram 通知發送失敗：", err));
    }

    function scanPageForRestock() {
        let now = new Date().toLocaleTimeString('en-GB');
        updateUILastCheck(now);

        // 💡 視覺掃描：直接尋找畫面上的紅色購買按鈕
        let buyBtn = document.querySelector('.p-button--red, .m-btn.add-to-cart, #js-addCart, button[data-bs-text-key="msg.placePreOrder"]');
        let isActuallyInStock = false;

        if (buyBtn) {
            let isNoActive = buyBtn.classList.contains('is-noActive');
            let isDisabled = buyBtn.classList.contains('is-disabled');
            let isHidden = window.getComputedStyle(buyBtn).display === 'none';
            
            // 只要按鈕存在、沒有被停用、沒有被隱藏，就是真正有貨！
            if (!isNoActive && !isDisabled && !isHidden) {
                isActuallyInStock = true;
            }
        }

        if (isActuallyInStock) {
            // 🚨 發現有貨！
            updateUIStatus("IN STOCK! (有貨)", "#00ff88");
            console.log(`[PB-Monitor] 狀態：有貨！`);
            
            // 🎯 重要：有貨即刻停止 F5，鎖定頁面讓使用者購買
            stopSystem(); 
            document.getElementById('pbm-toggle-btn').innerText = "✅ 成功鎖定！(已停止 F5)";
            document.getElementById('pbm-toggle-btn').style.background = "#007bff";
            
            let productName = document.title.split('|')[0].trim();
            let msg = `🚨 <b>【P-Bandai 補貨通知】</b> 🚨\n\n📦 <b>商品:</b> ${productName}\n🛒 <b>狀態:</b> 現在有貨！\n🔗 <b>快啲去買:</b> <a href="${window.location.href}">${window.location.href}</a>`;
            sendTelegramAlert(msg);
            
            // 播放提示音效
            try {
                let audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
                audio.play();
            } catch(e) {}

        } else {
            // ❌ 無貨，排程下一次刷新
            updateUIStatus("Out of Stock (無貨)", "#ff4444");
            console.log(`[PB-Monitor] 狀態：無貨，準備下次刷新`);
            scheduleNextReload();
        }
    }

    function scheduleNextReload() {
        if (!isMonitoring) return;
        
        let nextInterval = Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
        let nextTime = new Date(Date.now() + nextInterval).toLocaleTimeString('en-GB');
        document.getElementById('pbm-next').innerText = `${nextTime} (將自動 F5)`;
        
        reloadTimer = setTimeout(() => {
            window.location.reload();
        }, nextInterval);
    }

    // ==========================================
    // 🎨 用戶介面區 (UI CREATION)
    // ==========================================

    function createUI() {
        if (document.getElementById('pbm-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'pbm-panel';
        panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:280px;background:rgba(20,20,20,0.95);color:#fff;z-index:999999;padding:15px;border-radius:8px;font-size:13px;border:1px solid #444;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:sans-serif;';

        panel.innerHTML = `
            <h3 style="color:#fc0;margin:0 0 10px;border-bottom:1px solid #555;padding-bottom:5px;font-size:14px;font-weight:bold;">
                🛰️ P-Bandai Stock Monitor V6.1
            </h3>
            <div style="margin-bottom:8px">
                <span style="color:#aaa;">Status: </span>
                <span id="pbm-status" style="font-weight:bold;color:#aaa;">Stopped</span>
            </div>
            <div style="margin-bottom:8px;font-size:11px;color:#aaa;">
                Last Check: <span id="pbm-last">--:--:--</span><br>
                Next Check: <span id="pbm-next">--:--:--</span>
            </div>
            <button id="pbm-toggle-btn" style="width:100%;padding:8px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">▶️ Start Monitor</button>
            <div style="text-align:right; margin-top:8px; font-size:10px; color:#666;">presented by 一柿</div>
        `;
        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('pbm-toggle-btn');
        
        toggleBtn.addEventListener('click', function() {
            if (isMonitoring) {
                stopSystem();
            } else {
                startSystem();
                sendTelegramAlert(`📡 <b>系統啟動 (V6.1)</b>\n正在監控: ${document.title.split('|')[0]}`);
            }
        });

        // 恢復上一手狀態：如果 F5 完發現仲係 monitoring 狀態
        if (isMonitoring) {
            toggleBtn.innerText = "⏹️ Stop Monitor";
            toggleBtn.style.background = "#dc3545";
            updateUIStatus("Scanning...", "#ffcc00");
            
            // 延遲 3 秒，確保 P-Bandai 個網頁同啲掣已經畫好晒先 Scan
            setTimeout(scanPageForRestock, 3000);
        }
    }

    function startSystem() {
        isMonitoring = true;
        localStorage.setItem('pbm_v6_monitoring', 'true');
        document.getElementById('pbm-toggle-btn').innerText = "⏹️ Stop Monitor";
        document.getElementById('pbm-toggle-btn').style.background = "#dc3545";
        
        scanPageForRestock();
    }

    function stopSystem() {
        isMonitoring = false;
        localStorage.setItem('pbm_v6_monitoring', 'false');
        
        let btn = document.getElementById('pbm-toggle-btn');
        if (!btn.innerText.includes("鎖定")) {
            btn.innerText = "▶️ Start Monitor";
            btn.style.background = "#28a745";
            updateUIStatus("Stopped", "#aaa");
        }
        
        document.getElementById('pbm-next').innerText = "--:--:--";
        clearTimeout(reloadTimer);
    }

    function updateUIStatus(text, color) {
        const st = document.getElementById('pbm-status');
        if(st) { st.innerText = text; st.style.color = color; }
    }

    function updateUILastCheck(timeStr) {
        const lc = document.getElementById('pbm-last');
        if(lc) lc.innerText = timeStr;
    }

    // 確保頁面載入後先建立 UI
    setTimeout(createUI, 1000);
})();
