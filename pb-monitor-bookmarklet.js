(function() {
    'use strict';

    if (document.getElementById('pbm-panel')) {
        console.log("Monitor already loaded.");
        return;
    }

    const TG_TOKEN = "8744700068:AAG5q3FS3ST78U0j1D4LZhej9DBvmHb0t_E"; 
    const TG_CHAT_ID = "696084464"; 
    
    const MIN_INTERVAL = 60000; 
    const MAX_INTERVAL = 120000; 

    let monitorTimer = null;
    let isMonitoring = false;
    let lastStatusWasOutOfStock = true;

    function sendTelegramAlert(message) {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        const body = { chat_id: TG_CHAT_ID, text: message, parse_mode: 'HTML' };
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(res => { if(!res.ok) console.error("❌ Telegram Failed:", res.status); })
        .catch(err => console.error("❌ Telegram Error:", err));
    }

    function checkStock() {
        if (!isMonitoring) return;
        const currentUrl = window.location.href;
        updateUIStatus("Checking...", "#ffcc00");

        fetch(currentUrl + "?t=" + new Date().getTime(), { headers: { 'Cache-Control': 'no-cache' } })
        .then(res => res.text())
        .then(htmlText => {
            let now = new Date().toLocaleTimeString('en-GB');
            updateUILastCheck(now);

            // 💡 V3.2 精準判斷邏輯 (針對 p-button--red 同 msg.placePreOrder)
            
            // 1. 搵有冇「送出訂單 / PLACE PRE-ORDER / 加入購物車」嘅專屬特徵
            // 包含舊版 m-btn p-btn-red 同新版 p-button--red / msg.placePreOrder
            let hasRedBtn = htmlText.includes('p-button--red') || 
                            htmlText.includes('msg.placePreOrder') || 
                            htmlText.includes('m-btn p-btn-red') || 
                            htmlText.includes('id="js-addCart"');
            
            // 2. 搵有冇「死掣」特徵
            // 包含舊版 is-disabled 同新版 is-noActive
            let isDisabled = htmlText.includes('is-noActive') || 
                             htmlText.includes('is-disabled');

            // 3. 直接檢查有無新版專屬嘅「缺貨屬性」
            let hasOutOfStockText = htmlText.includes('msg.sorryOutOfStock');

            // 💡 判斷：
            // 如果 (冇紅掣) 或者 (掣變咗 noActive/disabled) 或者 (出現 msg.sorryOutOfStock) -> 無貨
            let isOutOfStock = (!hasRedBtn) || isDisabled || hasOutOfStockText;

            if (isOutOfStock) {
                updateUIStatus("Out of Stock (無貨)", "#ff4444");
                lastStatusWasOutOfStock = true;
                console.log(`[${now}] 狀態：無貨`);
            } else {
                updateUIStatus("IN STOCK! (有貨)", "#00ff88");
                console.log(`[${now}] 狀態：有貨！`);
                if (lastStatusWasOutOfStock) {
                    let productName = document.title.split('|')[0].trim();
                    let msg = `🚨 <b>【P-Bandai 補貨通知】</b> 🚨\n\n📦 <b>商品:</b> ${productName}\n🛒 <b>狀態:</b> 現在有貨！\n🔗 <b>快啲去買:</b> <a href="${currentUrl}">${currentUrl}</a>`;
                    sendTelegramAlert(msg);
                    lastStatusWasOutOfStock = false; 
                }
            }
            scheduleNextCheck();
        })
        .catch(err => {
            console.error("檢查失敗：", err);
            updateUIStatus("Error - Retrying...", "#ffaa00");
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
        const panel = document.createElement('div');
        panel.id = 'pbm-panel';
        panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:240px;background:rgba(20,20,20,0.95);color:#fff;z-index:999999;padding:15px;border-radius:8px;font-size:13px;border:1px solid #444;box-shadow:0 4px 15px rgba(0,0,0,0.5);font-family:sans-serif;';
        
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #555; padding-bottom:5px; margin-bottom:10px;">
                <h3 style="color:#fc0; margin:0; font-size:14px; font-weight:bold;">🛰️ PB Monitor V3.2</h3>
                <span id="pbm-close" style="cursor:pointer; color:#999; font-size:14px; font-weight:bold;">✕</span>
            </div>
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

        document.getElementById('pbm-close').onclick = function() {
            isMonitoring = false;
            clearTimeout(monitorTimer);
            panel.remove();
        };

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
                sendTelegramAlert(`📡 <b>系統啟動 (V3.2)</b>\n正在監控: <a href="${window.location.href}">${document.title.split('|')[0]}</a>`);
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
