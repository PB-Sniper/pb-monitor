// ==UserScript==
// @name         P-Bandai Stock Monitor (V1.4 Perfect DOM)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  使用 DOMParser 精準鎖定購買按鈕，無視背景隱藏干擾字眼
// @author       Industrial Revolution
// @match        https://p-bandai.com/hk/item/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TG_TOKEN = "8744700068:AAG5q3FS3ST78U0j1D4LZhej9DBvmHb0t_E";
    const TG_CHAT_ID = "696084464";

    const MIN_INTERVAL = 60000; // 1 分鐘
    const MAX_INTERVAL = 120000; // 2 分鐘

    let monitorTimer = null;
    let isMonitoring = false;
    let lastStatusWasOutOfStock = true;

    function sendTelegramAlert(message) {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        const body = { chat_id: TG_CHAT_ID, text: message, parse_mode: 'HTML' };
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .catch(err => console.error("❌ Telegram 請求錯誤：", err));
    }

    function checkStock() {
        if (!isMonitoring) return;

        const currentUrl = window.location.href;
        updateUIStatus("Checking...", "#ffcc00");

        fetch(currentUrl + "?t=" + new Date().getTime(), {
            credentials: 'include',
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(res => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.text();
        })
        .then(htmlText => {
            let now = new Date().toLocaleTimeString('en-GB');
            updateUILastCheck(now);

            // 💡 V1.4 核心：將文字轉為真實 DOM 結構
            let parser = new DOMParser();
            let doc = parser.parseFromString(htmlText, 'text/html');

            // 1. 精準鎖定「購買按鈕」元素本身 (包含所有可能嘅紅掣 class)
            // p-button--red 係最新版, m-btn / add-to-cart 係舊版
            let buyBtn = doc.querySelector('.p-button--red, .m-btn.add-to-cart, #js-addCart, button[data-bs-text-key="msg.placePreOrder"]');

            // 2. 判斷有貨條件：
            // - 必須要搵到個掣 (buyBtn !== null)
            // - 個掣「唔可以」有 is-noActive (新版灰掣)
            // - 個掣「唔可以」有 is-disabled (舊版灰掣)
            let isActuallyInStock = false;
            
            if (buyBtn) {
                let isNoActive = buyBtn.classList.contains('is-noActive');
                let isDisabled = buyBtn.classList.contains('is-disabled');
                
                // 如果個掣存在，並且無被 disable，就係有貨！
                if (!isNoActive && !isDisabled) {
                    isActuallyInStock = true;
                }
            }

            if (isActuallyInStock) {
                updateUIStatus("IN STOCK! (有貨)", "#00ff88");
                console.log(`[${now}] 狀態：有貨！`);

                if (lastStatusWasOutOfStock) {
                    let productName = document.title.split('|')[0].trim();
                    let msg = `🚨 <b>【P-Bandai 補貨通知】</b> 🚨\n\n📦 <b>商品:</b> ${productName}\n🛒 <b>狀態:</b> 現在有貨！\n🔗 <b>快啲去買:</b> <a href="${currentUrl}">${currentUrl}</a>`;
                    sendTelegramAlert(msg);
                    
                    try {
                        let audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
                        audio.play();
                    } catch(e) {}
                    
                    lastStatusWasOutOfStock = false; 
                }
            } else {
                updateUIStatus("Out of Stock (無貨)", "#ff4444");
                lastStatusWasOutOfStock = true;
                console.log(`[${now}] 狀態：無貨`);
            }

            scheduleNextCheck();
        })
        .catch(err => {
            console.error("檢查失敗：", err);
            updateUIStatus("Error - Blocked/Timeout", "#ffaa00");
            scheduleNextCheck();
        });
    }

    function scheduleNextCheck() {
        if (!isMonitoring) return;
        const nextInterval = Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
        let nextTime = new Date(Date.now() + nextInterval).toLocaleTimeString('en-GB');
        document.getElementById('pbm-next').innerText = nextTime;
        monitorTimer = setTimeout(checkStock, nextInterval);
    }

    function createUI() {
        if (document.getElementById('pbm-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'pbm-panel';
        panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:240px;background:rgba(20,20,20,0.95);color:#fff;z-index:999999;padding:15px;border-radius:8px;font-size:13px;border:1px solid #444;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:sans-serif;';

        panel.innerHTML = `
            <h3 style="color:#fc0;margin:0 0 10px;border-bottom:1px solid #555;padding-bottom:5px;font-size:14px;font-weight:bold;">
                🛰️ Bandai Monitor V1.4
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
        `;
        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('pbm-toggle-btn');
        toggleBtn.addEventListener('click', function() {
            if (isMonitoring) {
                isMonitoring = false;
                clearTimeout(monitorTimer);
                toggleBtn.innerText = "▶️ Start Monitor";
                toggleBtn.style.background = "#28a745";
                updateUIStatus("Stopped", "#aaa");
                document.getElementById('pbm-next').innerText = "--:--:--";
            } else {
                isMonitoring = true;
                toggleBtn.innerText = "⏹️ Stop Monitor";
                toggleBtn.style.background = "#dc3545";
                sendTelegramAlert(`📡 <b>系統啟動 (V1.4 精準 DOM 版)</b>\n正在監控: ${document.title.split('|')[0]}`);
                checkStock();
            }
        });
    }

    function updateUIStatus(text, color) {
        const st = document.getElementById('pbm-status');
        if(st) { st.innerText = text; st.style.color = color; }
    }

    function updateUILastCheck(timeStr) {
        const lc = document.getElementById('pbm-last');
        if(lc) lc.innerText = timeStr;
    }

    createUI();
})();
