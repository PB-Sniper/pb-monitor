(function() {
    'use strict';

    if (document.getElementById('pbm-panel')) {
        console.log("Monitor already loaded.");
        return;
    }

    const TG_TOKEN = "8744700068:AAG5q3FS3ST78U0j1D4LZhej9DBvmHb0t_E"; 
    const TG_CHAT_ID = "696084464"; 
    
    // 每 10 秒直接掃描一次「當前畫面」
    const CHECK_INTERVAL = 10000; 

    let monitorTimer = null;
    let isMonitoring = false;
    let lastStatusWasOutOfStock = true;

    function sendTelegramAlert(message) {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        const body = { chat_id: TG_CHAT_ID, text: message, parse_mode: 'HTML' };
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .catch(err => console.error("❌ Telegram Error:", err));
    }

    function checkStock() {
        if (!isMonitoring) return;
        
        let now = new Date().toLocaleTimeString('en-GB');
        updateUILastCheck(now);

        // 💡 V5.0 絕招：唔 Fetch 啦！直接喺你「眼前個網頁 (document)」搵個掣！
        let activeCartBtn = document.querySelector('button.p-button--red, a.p-button--red, button.add-to-cart, a.add-to-cart, #js-addCart');
        
        let isBtnDisabled = false;
        if (activeCartBtn) {
            isBtnDisabled = activeCartBtn.classList.contains('is-noActive') || 
                            activeCartBtn.classList.contains('is-disabled');
        }

        // 如果眼前連掣都無，或者個掣灰咗，就係無貨
        let isOutOfStock = (!activeCartBtn) || isBtnDisabled;

        if (isOutOfStock) {
            updateUIStatus("Out of Stock (無貨)", "#ff4444");
            lastStatusWasOutOfStock = true;
            console.log(`[${now}] 狀態：無貨`);
        } else {
            updateUIStatus("IN STOCK! (有貨)", "#00ff88");
            console.log(`[${now}] 狀態：有貨！`);
            if (lastStatusWasOutOfStock) {
                let productName = document.title.split('|')[0].trim();
                let msg = `🚨 <b>【P-Bandai 補貨通知】</b> 🚨\n\n📦 <b>商品:</b> ${productName}\n🛒 <b>狀態:</b> 現在有貨！\n🔗 <b>快啲去買:</b> <a href="${window.location.href}">${window.location.href}</a>`;
                sendTelegramAlert(msg);
                lastStatusWasOutOfStock = false; 
            }
        }
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'pbm-panel';
        panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:240px;background:rgba(20,20,20,0.95);color:#fff;z-index:999999;padding:15px;border-radius:8px;font-size:13px;border:1px solid #444;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:sans-serif;';
        
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px;">
                <h3 style="color:#fc0; margin:0; font-size:14px; font-weight:bold;">🛰️ PB Monitor V5.0</h3>
                <span id="pbm-close" style="cursor:pointer; color:#999; font-size:14px; font-weight:bold;">✕</span>
            </div>
            <div style="margin-bottom:8px">
                <span style="color:#aaa;">Status: </span>
                <span id="pbm-status" style="font-weight:bold;color:#aaa;">Stopped</span>
            </div>
            <div style="margin-bottom:8px;font-size:11px;color:#aaa;">
                Last Check: <span id="pbm-last">--:--:--</span>
            </div>
            <button id="pbm-toggle-btn" style="width:100%;padding:8px;background:#28a745;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">▶️ Start Monitor</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('pbm-close').onclick = function() {
            isMonitoring = false;
            clearInterval(monitorTimer);
            panel.remove();
        };

        const toggleBtn = document.getElementById('pbm-toggle-btn');
        toggleBtn.addEventListener('click', function() {
            if (isMonitoring) {
                isMonitoring = false;
                clearInterval(monitorTimer);
                toggleBtn.innerText = "▶️ Start Monitor";
                toggleBtn.style.background = "#28a745";
                updateUIStatus("Stopped", "#aaa");
            } else {
                isMonitoring = true;
                toggleBtn.innerText = "⏹️ Stop Monitor";
                toggleBtn.style.background = "#dc3545";
                sendTelegramAlert(`📡 <b>系統啟動 (V5.0 直讀畫面版)</b>`);
                checkStock(); // 立即 Check 一次
                monitorTimer = setInterval(checkStock, CHECK_INTERVAL); // 每 10 秒循環望一次畫面
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
